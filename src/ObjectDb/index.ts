import { UniqueId } from "@anderjason/node-crypto";
import { LocalFile } from "@anderjason/node-filesystem";
import { Dict, TypedEvent } from "@anderjason/observable";
import { Duration, Instant, Stopwatch } from "@anderjason/time";
import {
  ArrayUtil,
  ObjectUtil,
  SetUtil,
  StringUtil
} from "@anderjason/util";
import { Actor, Timer } from "skytree";
import { Entry, PortableEntry } from "../Entry";
import { Metric } from "../Metric";
import { DbInstance } from "../SqlClient";
import { Tag } from "../Tag";

export interface Order {
  key: string;
  direction: "ascending" | "descending";
}

export interface ObjectDbReadOptions {
  requireTagKeys?: string[];
  orderByMetric?: Order;
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface ObjectDbProps<T> {
  localFile: LocalFile;

  tagKeysGivenEntry: (entry: Entry<T>) => string[];
  metricsGivenEntry: (entry: Entry<T>) => Dict<string>;

  cacheSize?: number;
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

  private _tagPrefixes = new Set<string>();
  private _tags = new Map<string, Tag>();
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

  get tags(): Tag[] {
    return Array.from(this._tags.values());
  }

  get metrics(): Metric[] {
    return Array.from(this._metrics.values());
  }

  get tagPrefixes(): string[] {
    return Array.from(this._tagPrefixes);
  }

  private load(): void {
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
      CREATE TABLE IF NOT EXISTS tags (
        key TEXT PRIMARY KEY,
        tagPrefix TEXT NOT NULL,
        tagValue TEXT NOT NULL
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
      CREATE TABLE IF NOT EXISTS tagEntries (
        tagKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        FOREIGN KEY(tagKey) REFERENCES tags(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key),
        UNIQUE(tagKey, entryKey)
      )
    `);

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
      CREATE INDEX IF NOT EXISTS idxTagPrefix 
      ON tags(tagPrefix);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesTagKey 
      ON tagEntries(tagKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesEntryKey
      ON tagEntries(entryKey);
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

    this.stopwatch.start("pruneTagsAndMetrics");
    db.runQuery(`
      DELETE FROM tags WHERE key IN (
        SELECT t.key FROM tags AS t
        LEFT JOIN tagEntries AS te ON te.tagKey = t.key
        WHERE te.entryKey IS NULL
      );    
    `);
    db.runQuery(`
      DELETE FROM metrics WHERE key IN (
        SELECT m.key FROM metrics AS m
        LEFT JOIN metricValues AS mv ON mv.metricKey = m.key
        WHERE mv.entryKey IS NULL
      );    
    `);
    this.stopwatch.stop("pruneTagsAndMetrics");

    db.prepareCached(
      "INSERT OR IGNORE INTO meta (id, properties) VALUES (0, ?)"
    ).run("{}");

    db.toRows("SELECT properties FROM meta").forEach((row) => {
      const properties = JSON.parse(row.properties ?? "{}");

      // assign property definitions
      for (const key of Object.keys(properties)) {
        this._properties.set(key, properties[key]);
      }
    });

    this.stopwatch.start("selectTagKeys");
    const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);
    this.stopwatch.stop("selectTagKeys");

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

    this.stopwatch.start("createTags");
    const tagKeyCount = tagKeys.length;
    for (let i = 0; i < tagKeyCount; i++) {
      const tagKey = tagKeys[i];

      this.stopwatch.start("createTag");
      const tag = new Tag({
        tagKey,
        db: this._db,
        stopwatch: this.stopwatch,
      });
      this.stopwatch.stop("createTag");

      this.stopwatch.start("activateTag");
      this.addActor(tag);
      this.stopwatch.stop("activateTag");

      this._tags.set(tagKey, tag);
      this._tagPrefixes.add(tag.tagPrefix);
    }
    this.stopwatch.stop("createTags");

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
  }

  toEntryKeys(options: ObjectDbReadOptions = {}): string[] {
    this.stopwatch.start("toEntryKeys");

    const now = Instant.ofNow();

    let entryKeys: string[] = undefined;

    let fullCacheKey: number = undefined;
    if (options.cacheKey != null) {
      const tagKeys = (options.requireTagKeys || []).join(",");
      const cacheKeyData = `${options.cacheKey}:${options.orderByMetric?.direction}:${options.orderByMetric?.key}:${tagKeys}`;
      fullCacheKey = StringUtil.hashCodeGivenString(cacheKeyData);
    }

    if (fullCacheKey != null) {
      const cacheData = this._caches.get(fullCacheKey);
      if (cacheData != null) {
        cacheData.expiresAt = now.withAddedDuration(Duration.givenSeconds(120));
        entryKeys = cacheData.entryKeys;
      }
    }

    if (entryKeys == null) {
      if (
        options.requireTagKeys == null ||
        options.requireTagKeys.length === 0
      ) {
        entryKeys = Array.from(this._entryKeys);
      } else {
        const sets = options.requireTagKeys.map((tagKey) => {
          const tag = this._tags.get(tagKey);
          if (tag == null) {
            return new Set<string>();
          }

          return new Set(tag.entryKeys.values());
        });

        entryKeys = Array.from(SetUtil.intersectionGivenSets(sets));
      }

      const order = options.orderByMetric;
      if (order != null) {
        const metric = this._metrics.get(order.key);
        if (metric != null) {
          entryKeys = ArrayUtil.arrayWithOrderFromValue(
            entryKeys,
            (entryKey) => {
              return metric.entryMetricValues.get(entryKey);
            },
            order.direction
          );
        }
      }
    }

    if (options.cacheKey != null && !this._caches.has(fullCacheKey)) {
      this._caches.set(fullCacheKey, {
        entryKeys,
        expiresAt: now.withAddedDuration(Duration.givenSeconds(120)),
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
  forEach(fn: (entry: Entry<T>) => void): void {
    this._entryKeys.forEach((entryKey) => {
      const entry = this.toOptionalEntryGivenKey(entryKey);
      fn(entry);
    });
  }

  hasEntry(entryKey: string): boolean {
    const keys = this.toEntryKeys();
    return keys.includes(entryKey);
  }

  runTransaction(fn: () => void): void {
    let failed = false;

    this._db.runTransaction(() => {
      try {
        fn();
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

  toEntryCount(requireTagKeys?: string[]): number {
    const keys = this.toEntryKeys({
      requireTagKeys: requireTagKeys,
    });

    return keys.length;
  }

  toEntries(options: ObjectDbReadOptions = {}): Entry<T>[] {
    const entryKeys = this.toEntryKeys(options);

    const entries: Entry<T>[] = [];

    entryKeys.forEach((entryKey) => {
      const result = this.toOptionalEntryGivenKey(entryKey);
      if (result != null) {
        entries.push(result);
      }
    });

    return entries;
  }

  toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Entry<T> | undefined {
    const results = this.toEntries({
      ...options,
      limit: 1,
    });

    return results[0];
  }

  toEntryGivenKey(entryKey: string): Entry<T> {
    const result = this.toOptionalEntryGivenKey(entryKey);
    if (result == null) {
      throw new Error(`Entry not found for key '${entryKey}'`);
    }

    return result;
  }

  toOptionalEntryGivenKey(entryKey: string): Entry<T> | undefined {
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
    });

    const didLoad = result.load();

    this.stopwatch.stop("toOptionalEntryGivenKey");

    if (!didLoad) {
      return undefined;
    }

    return result;
  }

  setProperty(property: PropertyDefinition): void {
    this._properties.set(property.key, property);
    this.saveProperties();
  }

  deletePropertyKey(key: string): void {
    this._properties.delete(key);
    this.saveProperties();
  }

  toPropertyGivenKey(key: string): PropertyDefinition {
    return this._properties.get(key);
  }

  toProperties(): PropertyDefinition[] {
    return Array.from(this._properties.values());
  }

  private saveProperties(): void {
    // convert this._properties to a plain javascript object
    const portableProperties: Dict<PropertyDefinition> = {};
    this._properties.forEach((property, key) => {
      portableProperties[key] = property;
    });

    this._db
      .prepareCached("UPDATE meta SET properties = ?")
      .run(JSON.stringify(portableProperties));
  }

  removeMetadataGivenEntryKey(entryKey: string): void {
    const tagKeys = this._db
      .prepareCached(
        "select distinct tagKey from tagEntries where entryKey = ?"
      )
      .all(entryKey)
      .map((row) => row.tagKey);

    tagKeys.forEach((tagKey) => {
      const tag = this.tagGivenTagKey(tagKey);
      tag.deleteValue(entryKey);
    });

    const metricKeys = this._db
      .prepareCached(
        "select distinct metricKey from metricValues where entryKey = ?"
      )
      .all(entryKey)
      .map((row) => row.metricKey);

    metricKeys.forEach((metricKey) => {
      const metric = this.metricGivenMetricKey(metricKey);
      metric.deleteKey(entryKey);
    });
  }

  rebuildMetadata(): void {
    this.toEntryKeys().forEach((entryKey) => {
      const entry = this.toOptionalEntryGivenKey(entryKey);
      if (entry != null) {
        this.rebuildMetadataGivenEntry(entry);
      }
    });
  }

  tagGivenPropertyKeyAndValue(propertyKey: string, value: any): string {
    if (propertyKey == null) {
      return;
    }

    const property = this.toPropertyGivenKey(propertyKey);
    if (property == null) {
      return;
    }

    switch (property.type) {
      case "select":
        return `${property.key}:${value}`;
      default:
        return undefined;
    }
  } 

  propertyTagKeysGivenEntry(entry: Entry<T>): string[] {
    const result = new Set<string>();

    for (const [key, value] of entry.propertyValues) {
      const tag = this.tagGivenPropertyKeyAndValue(key, value);
      if (tag != null) {
        result.add(tag);
      }
    }

    return Array.from(result);
  }

  rebuildMetadataGivenEntry(entry: Entry<T>): void {
    this.stopwatch.start("rebuildMetadataGivenEntry");
    this.removeMetadataGivenEntryKey(entry.key);

    const tagKeys = this.props.tagKeysGivenEntry(entry);
    const metricValues = this.props.metricsGivenEntry(entry);

    
    metricValues.createdAt = entry.createdAt.toEpochMilliseconds().toString();
    metricValues.updatedAt = entry.updatedAt.toEpochMilliseconds().toString();

    tagKeys.forEach((tagKey) => {
      const tag = this.tagGivenTagKey(tagKey);
      tag.addValue(entry.key);
    });

    Object.keys(metricValues).forEach((metricKey) => {
      const metric = this.metricGivenMetricKey(metricKey);

      const metricValue = metricValues[metricKey];
      metric.setValue(entry.key, metricValue);
    });

    this.stopwatch.stop("rebuildMetadataGivenEntry");
  }

  writeEntry(entry: Entry<T> | PortableEntry<T>): void {
    if (entry == null) {
      throw new Error("Entry is required");
    }

    switch (entry.status) {
      case "deleted":
        this.deleteEntryKey(entry.key);
        break;
      case "new":
      case "saved":
      case "updated":
      case "unknown":
        if ("createdAt" in entry) {
          this.writeEntryData(entry.data, entry.key, entry.createdAt);
        } else {
          const createdAt =
            entry.createdAtEpochMs != null
              ? Instant.givenEpochMilliseconds(entry.createdAtEpochMs)
              : undefined;
          this.writeEntryData(entry.data, entry.key, createdAt);
        }

        break;
      default:
        throw new Error(`Unsupported entry status '${entry.status}'`);
    }
  }

  tagGivenTagKey(tagKey: string): Tag {
    let tag = this._tags.get(tagKey);
    if (tag == null) {
      tag = this.addActor(
        new Tag({
          tagKey,
          db: this._db,
          stopwatch: this.stopwatch,
        })
      );
      this._tags.set(tagKey, tag);
    }

    return tag;
  }

  metricGivenMetricKey(metricKey: string): Metric {
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

  writeEntryData(
    entryData: T,
    entryKey?: string,
    createdAt?: Instant
  ): Entry<T> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const oldData = this.toOptionalEntryGivenKey(entryKey)?.data;
    if (ObjectUtil.objectIsDeepEqual(oldData, entryData)) {
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

    let entry = this.toOptionalEntryGivenKey(entryKey);
    if (entry == null) {
      entry = new Entry<T>({
        key: entryKey,
        db: this._db,
        createdAt: createdAt || now,
        updatedAt: now,
      });
      didCreateNewEntry = true;
    }

    entry.data = entryData;

    this.stopwatch.start("save");
    entry.save();
    this.stopwatch.stop("save");

    this._entryKeys.add(entryKey);
    this.rebuildMetadataGivenEntry(entry);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }

    this.entryDidChange.emit(change);

    this.stopwatch.stop("writeEntryData");

    return entry;
  }

  deleteEntryKey(entryKey: string): void {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const existingRecord = this.toOptionalEntryGivenKey(entryKey);
    if (existingRecord == null) {
      return;
    }

    const change: EntryChange<T> = {
      key: entryKey,
      oldData: existingRecord.data,
    };

    this.entryWillChange.emit(change);

    this.removeMetadataGivenEntryKey(entryKey);

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
