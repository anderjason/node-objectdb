import { UniqueId } from "@anderjason/node-crypto";
import { LocalFile } from "@anderjason/node-filesystem";
import { Dict, Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Duration, Instant, Stopwatch } from "@anderjason/time";
import { ArrayUtil, ObjectUtil, SetUtil, StringUtil } from "@anderjason/util";
import { Actor, Timer } from "skytree";
import { AbsoluteBucketIdentifier, Bucket, Dimension, DimensionProps } from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { Metric } from "../Metric";
import { DbInstance } from "../SqlClient";
import { PortableTag } from "../Tag/PortableTag";

export interface Order {
  key: string;
  direction: "ascending" | "descending";
}

export type TagLookup = string | PortableTag;

export interface ObjectDbReadOptions {
  filter?: AbsoluteBucketIdentifier[];
  orderByMetric?: Order;
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface ObjectDbProps<T> {
  label: string;
  localFile: LocalFile;

  metricsGivenEntry: (entry: Entry<T>) => Dict<string>;

  cacheSize?: number;
  dimensions?: Dimension<T, DimensionProps>[];
}

export interface EntryChange<T> {
  key: string;

  oldData?: T;
  newData?: T;
}

interface CacheData {
  expiresAt: Instant;
  entryKeys: string[];
}

interface BasePropertyDefinition {
  key: string;
  label: string;
  listOrder: number;
}

export interface SelectPropertyOption {
  key: string;
  label: string;
}

export interface SelectPropertyDefinition extends BasePropertyDefinition {
  type: "select";
  options: SelectPropertyOption[];
}

export type PropertyDefinition = SelectPropertyDefinition;

export class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
  readonly collectionDidChange = new TypedEvent();
  readonly entryWillChange = new TypedEvent<EntryChange<T>>();
  readonly entryDidChange = new TypedEvent<EntryChange<T>>();

  readonly stopwatch: Stopwatch;

  protected _isLoaded = Observable.givenValue(false, Observable.isStrictEqual);
  readonly isLoaded = ReadOnlyObservable.givenObservable(this._isLoaded);

  private _dimensionsByKey = new Map<string, Dimension<T, DimensionProps>>();
  private _metrics = new Map<string, Metric>();
  private _properties = new Map<string, PropertyDefinition>();
  private _entryKeys = new Set<string>();
  private _caches = new Map<number, CacheData>();

  private _db: DbInstance;

  constructor(props: ObjectDbProps<T>) {
    super(props);

    this.stopwatch = new Stopwatch(props.localFile.toAbsolutePath());
  }

  onActivate(): void {
    this._db = this.addActor(
      new DbInstance({
        localFile: this.props.localFile,
      })
    );

    this.addActor(
      new Timer({
        duration: Duration.givenMinutes(1),
        isRepeating: true,
        fn: () => {
          const nowMs = Instant.ofNow().toEpochMilliseconds();

          const entries = Array.from(this._caches.entries());
          for (const [key, val] of entries) {
            if (val.expiresAt.toEpochMilliseconds() < nowMs) {
              this._caches.delete(key);
            }
          }
        },
      })
    );

    this.load();
  }

  get metrics(): Metric[] {
    return Array.from(this._metrics.values());
  }

  private async load(): Promise<void> {
    if (this.isActive == false) {
      return;
    }

    const db = this._db;

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        properties TEXT NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS metrics (
        key text PRIMARY KEY
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS entries (
        key text PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS dimensions (
        key text PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS properties (
        key text PRIMARY KEY,
        definition TEXT NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS propertyValues (
        entryKey TEXT NOT NULL,
        propertyKey TEXT NOT NULL,
        propertyValue TEXT NOT NULL,
        FOREIGN KEY(propertyKey) REFERENCES properties(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key),
        UNIQUE(propertyKey, entryKey)
      )
    `);

    try {
      db.runQuery(`
        ALTER TABLE entries
        ADD COLUMN propertyValues TEXT
      `);
    } catch (err) {
      // ignore
    }

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue TEXT NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
        UNIQUE(metricKey, entryKey)
      )
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesMetricKey
      ON metricValues(metricKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesEntryKey
      ON metricValues(entryKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesMetricValue
      ON metricValues(metricValue);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idsPropertyValuesEntryKey
      ON propertyValues(entryKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxPropertyValuesPropertyKey
      ON propertyValues(propertyKey);
    `);

    db.prepareCached(
      "INSERT OR IGNORE INTO meta (id, properties) VALUES (0, ?)"
    ).run("{}");

    db.toRows("SELECT key, definition FROM properties").forEach((row) => {
      const { key, definition } = row;

      // assign property definitions
      this._properties.set(key, JSON.parse(definition));
    });

    this.stopwatch.start("selectEntryKeys");
    db.toRows("SELECT key FROM entries").forEach((row) => {
      this._entryKeys.add(row.key);
    });
    this.stopwatch.stop("selectEntryKeys");

    this.stopwatch.start("selectMetricKeys");
    const metricKeys = db
      .toRows("SELECT key FROM metrics")
      .map((row) => row.key);
    this.stopwatch.stop("selectMetricKeys");

    this.stopwatch.start("createMetrics");
    const metricKeyCount = metricKeys.length;
    for (let i = 0; i < metricKeyCount; i++) {
      const metricKey = metricKeys[i];

      const metric = this.addActor(
        new Metric({
          metricKey,
          db: this._db,
        })
      );

      this._metrics.set(metricKey, metric);
    }
    this.stopwatch.stop("createMetrics");

    this.stopwatch.start("addDimensions");
    if (this.props.dimensions != null) {
      for (const dimension of this.props.dimensions) {
        dimension.db = this._db;
        dimension.objectDb = this;

        this.addActor(dimension);
        await dimension.load();

        this._dimensionsByKey.set(dimension.key, dimension);
      }
    }
    this.stopwatch.stop("addDimensions");

    this._isLoaded.setValue(true);
  }

  async toEntryKeys(options: ObjectDbReadOptions = {}): Promise<string[]> {
    this.stopwatch.start("toEntryKeys");

    const now = Instant.ofNow();

    let entryKeys: string[] = undefined;

    let fullCacheKey: number = undefined;
    if (options.cacheKey != null) {
      const bucketIdentifiers: AbsoluteBucketIdentifier[] = options.filter ?? [];
      const buckets: Bucket<T>[] = [];
      
      for (const bucketIdentifier of bucketIdentifiers) {
        const bucket = this.toOptionalBucketGivenIdentifier(bucketIdentifier);
        if (bucket != null) {
          buckets.push(bucket);
        }
      }

      const hashCodes = buckets.map((bucket) => bucket.toHashCode());

      const cacheKeyData = `${options.cacheKey}:${
        options.orderByMetric?.direction
      }:${options.orderByMetric?.key}:${hashCodes.join(",")}`;
      fullCacheKey = StringUtil.hashCodeGivenString(cacheKeyData);
    }

    if (fullCacheKey != null) {
      const cacheData = this._caches.get(fullCacheKey);
      if (cacheData != null) {
        cacheData.expiresAt = now.withAddedDuration(Duration.givenSeconds(300));
        entryKeys = cacheData.entryKeys;
      }
    }

    if (entryKeys == null) {
      if (options.filter == null || options.filter.length === 0) {
        entryKeys = Array.from(this._entryKeys);
      } else {
        const sets: Set<string>[] = [];

        for (const bucketIdentifier of options.filter) {
          const bucket = this.toOptionalBucketGivenIdentifier(bucketIdentifier);
          if (bucket == null) {
            sets.push(new Set<string>());
          } else {
            const entryKeys: Set<string> = await bucket.toEntryKeys();
            sets.push(entryKeys);
          }
        }

        entryKeys = Array.from(SetUtil.intersectionGivenSets(sets));
      }

      const order = options.orderByMetric;
      if (order != null) {
        const metric = this._metrics.get(order.key);
        if (metric != null) {
          const entryMetricValues = await metric.toEntryMetricValues();

          entryKeys = ArrayUtil.arrayWithOrderFromValue(
            entryKeys,
            (entryKey) => {
              return entryMetricValues.get(entryKey);
            },
            order.direction
          );
        }
      }
    }

    if (options.cacheKey != null && !this._caches.has(fullCacheKey)) {
      this._caches.set(fullCacheKey, {
        entryKeys,
        expiresAt: now.withAddedDuration(Duration.givenSeconds(300)),
      });
    }

    let start = 0;
    let end = entryKeys.length;

    if (options.offset != null) {
      start = parseInt(options.offset as any, 10);
    }

    if (options.limit != null) {
      end = Math.min(end, start + parseInt(options.limit as any, 10));
    }

    const result = entryKeys.slice(start, end);

    this.stopwatch.stop("toEntryKeys");

    return result;
  }

  // TC: O(N)
  async forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void> {
    for (const entryKey of this._entryKeys) {
      const entry = await this.toOptionalEntryGivenKey(entryKey);
      await fn(entry);
    }
  }

  async hasEntry(entryKey: string): Promise<boolean> {
    const keys = await this.toEntryKeys();
    return keys.includes(entryKey);
  }

  async runTransaction(fn: () => Promise<void>): Promise<void> {
    let failed = false;

    this._db.runTransaction(async () => {
      try {
        await fn();
      } catch (err) {
        failed = true;
        console.error(err);
      }
    });

    if (failed) {
      throw new Error(
        "The transaction failed, and the ObjectDB instance in memory may be out of sync. You should reload the ObjectDb instance."
      );
    }
  }

  async toEntryCount(filter?: AbsoluteBucketIdentifier[]): Promise<number> {
    const keys = await this.toEntryKeys({
      filter,
    });

    return keys.length;
  }

  async toEntries(options: ObjectDbReadOptions = {}): Promise<Entry<T>[]> {
    const entryKeys = await this.toEntryKeys(options);

    const entries: Entry<T>[] = [];

    for (const entryKey of entryKeys) {
      const result = await this.toOptionalEntryGivenKey(entryKey);
      if (result != null) {
        entries.push(result);
      }
    }

    return entries;
  }

  async toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Promise<Entry<T> | undefined> {
    const results = await this.toEntries({
      ...options,
      limit: 1,
    });

    return results[0];
  }

  async toEntryGivenKey(entryKey: string): Promise<Entry<T>> {
    const result = await this.toOptionalEntryGivenKey(entryKey);
    if (result == null) {
      throw new Error(`Entry not found for key '${entryKey}'`);
    }

    return result;
  }

  async toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined> {
    if (entryKey == null) {
      throw new Error("Entry key is required");
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    this.stopwatch.start("toOptionalEntryGivenKey");

    const result: Entry<T> = new Entry<T>({
      key: entryKey,
      db: this._db,
      objectDb: this,
    });

    const didLoad = await result.load();

    this.stopwatch.stop("toOptionalEntryGivenKey");

    if (!didLoad) {
      return undefined;
    }

    return result;
  }

  async setProperty(property: PropertyDefinition): Promise<void> {
  }

  async deletePropertyKey(key: string): Promise<void> {
  }

  async toPropertyGivenKey(key: string): Promise<PropertyDefinition> {
    return undefined;
  }

  async toProperties(): Promise<PropertyDefinition[]> {
    return [];
  }

  async removeMetadataGivenEntryKey(entryKey: string): Promise<void> {
    for (const dimension of this._dimensionsByKey.values()) {
      await dimension.deleteEntryKey(entryKey);
    }

    const metricKeys = this._db
      .prepareCached(
        "select distinct metricKey from metricValues where entryKey = ?"
      )
      .all(entryKey)
      .map((row) => row.metricKey);

    for (const metricKey of metricKeys) {
      const metric = await this.metricGivenMetricKey(metricKey);
      metric.deleteKey(entryKey);
    }
  }

  async rebuildMetadata(): Promise<void> {
    console.log(`Rebuilding metadata for '${this.props.label}'...'`);
    
    const entryKeys = await this.toEntryKeys();

    console.log(`Found ${entryKeys.length} entries`);
    
    for (const entryKey of entryKeys) {
      const entry = await this.toOptionalEntryGivenKey(entryKey);
      if (entry != null) {
        await this.rebuildMetadataGivenEntry(entry);
      }
    }

    console.log('Done rebuilding metadata');
  }

  toOptionalBucketGivenIdentifier(bucketIdentifier: AbsoluteBucketIdentifier): Bucket<T> | undefined {
    if (bucketIdentifier == null) {
      return undefined;
    }

    const dimension = this._dimensionsByKey.get(bucketIdentifier.dimensionKey);
    if (dimension == null) {
      return undefined;
    }

    return dimension.toOptionalBucketGivenKey(bucketIdentifier.bucketKey);
  }

  async rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void> {
    this.stopwatch.start("rebuildMetadataGivenEntry");
    await this.removeMetadataGivenEntryKey(entry.key);

    const metricValues = this.props.metricsGivenEntry(entry);

    metricValues.createdAt = entry.createdAt.toEpochMilliseconds().toString();
    metricValues.updatedAt = entry.updatedAt.toEpochMilliseconds().toString();

    for (const dimension of this._dimensionsByKey.values()) {
      await dimension.entryDidChange(entry.key);
    }
    
    for (const metricKey of Object.keys(metricValues)) {
      const metric = await this.metricGivenMetricKey(metricKey);

      const metricValue = metricValues[metricKey];
      metric.setValue(entry.key, metricValue);
    }

    this.stopwatch.stop("rebuildMetadataGivenEntry");
  }

  async writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<void> {
    if (entry == null) {
      throw new Error("Entry is required");
    }

    switch (entry.status) {
      case "deleted":
        await this.deleteEntryKey(entry.key);
        break;
      case "new":
      case "saved":
      case "updated":
      case "unknown":
        if ("createdAt" in entry) {
          await this.writeEntryData(
            entry.data,
            entry.propertyValues,
            entry.key,
            entry.createdAt
          );
        } else {
          const createdAt =
            entry.createdAtEpochMs != null
              ? Instant.givenEpochMilliseconds(entry.createdAtEpochMs)
              : undefined;

          await this.writeEntryData(
            entry.data,
            entry.propertyValues,
            entry.key,
            createdAt
          );
        }

        break;
      default:
        throw new Error(`Unsupported entry status '${entry.status}'`);
    }
  }

  async metricGivenMetricKey(metricKey: string): Promise<Metric> {
    let metric = this._metrics.get(metricKey);
    if (metric == null) {
      metric = this.addActor(
        new Metric({
          metricKey,
          db: this._db,
        })
      );
      this._metrics.set(metricKey, metric);
    }

    return metric;
  }

  async writeEntryData(
    entryData: T,
    propertyValues: Dict<JSONSerializable> = {},
    entryKey?: string,
    createdAt?: Instant
  ): Promise<Entry<T>> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const oldEntry = await this.toOptionalEntryGivenKey(entryKey);
    const oldPortableEntry = oldEntry?.toPortableEntry();
    const oldData = oldPortableEntry?.data;
    const oldPropertyValues = oldPortableEntry?.propertyValues;

    if (
      ObjectUtil.objectIsDeepEqual(oldData, entryData) &&
      ObjectUtil.objectIsDeepEqual(oldPropertyValues, propertyValues)
    ) {
      // nothing changed
      return;
    }

    const change: EntryChange<T> = {
      key: entryKey,
      oldData,
      newData: entryData,
    };

    this.entryWillChange.emit(change);

    this.stopwatch.start("writeEntryData");

    const now = Instant.ofNow();
    let didCreateNewEntry = false;

    let entry = await this.toOptionalEntryGivenKey(entryKey);
    if (entry == null) {
      entry = new Entry<T>({
        key: entryKey,
        db: this._db,
        createdAt: createdAt || now,
        updatedAt: now,
        objectDb: this,
      });
      didCreateNewEntry = true;
    }

    entry.data = entryData;
    entry.propertyValues = propertyValues;

    this.stopwatch.start("save");
    await entry.save();
    this.stopwatch.stop("save");

    this._entryKeys.add(entryKey);
    await this.rebuildMetadataGivenEntry(entry);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }

    this.entryDidChange.emit(change);

    this.stopwatch.stop("writeEntryData");

    return entry;
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const existingRecord = await this.toOptionalEntryGivenKey(entryKey);
    if (existingRecord == null) {
      return;
    }

    const change: EntryChange<T> = {
      key: entryKey,
      oldData: existingRecord.data,
    };

    this.entryWillChange.emit(change);

    await this.removeMetadataGivenEntryKey(entryKey);

    this._db.runQuery(
      `
      DELETE FROM entries WHERE key = ?
    `,
      [entryKey]
    );

    this._entryKeys.delete(entryKey);

    this.entryDidChange.emit(change);
    this.collectionDidChange.emit();
  }
}
