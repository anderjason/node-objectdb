import { UniqueId } from "@anderjason/node-crypto";
import {
  Dict,
  Observable,
  ReadOnlyObservable,
  TypedEvent
} from "@anderjason/observable";
import { Duration, Instant } from "@anderjason/time";
import { ArrayUtil, ObjectUtil, SetUtil, StringUtil } from "@anderjason/util";
import { Actor, Timer } from "skytree";
import {
  AbsoluteBucketIdentifier,
  Bucket,
  Dimension,
  DimensionProps
} from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { Metric } from "../Metric";
import { MongoDb } from "../MongoDb";

export interface Order {
  key: string;
  direction: "ascending" | "descending";
}

export interface ObjectDbReadOptions {
  filter?: AbsoluteBucketIdentifier[];
  orderByMetric?: Order;
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface ObjectDbProps<T> {
  label: string;
  db: MongoDb;
  
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

  protected _isLoaded = Observable.givenValue(false, Observable.isStrictEqual);
  readonly isLoaded = ReadOnlyObservable.givenObservable(this._isLoaded);

  private _dimensionsByKey = new Map<string, Dimension<T, DimensionProps>>();
  private _metrics = new Map<string, Metric>();
  private _properties = new Map<string, PropertyDefinition>();
  private _entryKeys = new Set<string>();
  private _caches = new Map<number, CacheData>();

  private _db: MongoDb;

  onActivate(): void {
    this._db = this.props.db;
    
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
    await this._db.isConnected.toPromise(v => v);


    // db.toRows("SELECT key, definition FROM properties").forEach((row) => {
    //   const { key, definition } = row;

    //   // assign property definitions
    //   this._properties.set(key, JSON.parse(definition));
    // });

    const entries = await this._db.collection<PortableEntry<T>>("entries").find(undefined, {
      projection: { key: 1 }
    }).toArray();
    
    entries.forEach((row) => {
      const { key } = row;

      this._entryKeys.add(key);
    });

    const metrics = await this._db.collection<unknown>("metrics").find(undefined, {
      projection: { key: 1 }
    }).toArray();
    const metricKeys = metrics.map((row: any) => row.key);

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

    if (this.props.dimensions != null) {
      for (const dimension of this.props.dimensions) {
        dimension.db = this._db;
        dimension.objectDb = this;

        this.addActor(dimension);
        await dimension.load();

        this._dimensionsByKey.set(dimension.key, dimension);
      }
    }

    this._isLoaded.setValue(true);
  }

  async save(): Promise<void> {
    for (const dimension of this._dimensionsByKey.values()) {
      await dimension.save();
    }
  }

  async toEntryKeys(options: ObjectDbReadOptions = {}): Promise<string[]> {
    const now = Instant.ofNow();

    let entryKeys: string[] = undefined;

    let fullCacheKey: number = undefined;
    if (options.cacheKey != null) {
      const bucketIdentifiers: AbsoluteBucketIdentifier[] =
        options.filter ?? [];
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

  async toOptionalEntryGivenKey(
    entryKey: string
  ): Promise<Entry<T> | undefined> {
    if (entryKey == null) {
      throw new Error("Entry key is required");
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const result: Entry<T> = new Entry<T>({
      key: entryKey,
      db: this._db,
      objectDb: this,
    });

    const didLoad = await result.load();

    if (!didLoad) {
      return undefined;
    }

    return result;
  }

  toDimensions(): IterableIterator<Dimension<T, DimensionProps>> {
    return this._dimensionsByKey.values();
  }

  async setProperty(property: PropertyDefinition): Promise<void> {}

  async deletePropertyKey(key: string): Promise<void> {}

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

    const metricValues = await this._db.collection("metricValues").find({ entryKey: entryKey }).toArray();
    const metricKeys = metricValues.map((metricValue: any) => metricValue.metricKey);
    
    for (const metricKey of metricKeys) {
      const metric = await this.metricGivenMetricKey(metricKey);
      metric.deleteKey(entryKey);
    }
  }

  async rebuildMetadata(): Promise<void> {
    console.log(`Rebuilding metadata for ${this.props.label}...`);

    const entryKeys = await this.toEntryKeys();

    console.log(`Found ${entryKeys.length} entries`);

    for (const entryKey of entryKeys) {
      const entry = await this.toOptionalEntryGivenKey(entryKey);
      if (entry != null) {
        await this.rebuildMetadataGivenEntry(entry);
      }
    }

    console.log("Done rebuilding metadata");
  }

  toOptionalBucketGivenIdentifier(
    bucketIdentifier: AbsoluteBucketIdentifier
  ): Bucket<T> | undefined {
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

    await entry.save();

    this._entryKeys.add(entryKey);
    await this.rebuildMetadataGivenEntry(entry);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }

    this.entryDidChange.emit(change);

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

    await this._db.collection("entries").deleteOne({ id: entryKey });
    
    this._entryKeys.delete(entryKey);

    this.entryDidChange.emit(change);
    this.collectionDidChange.emit();
  }
}
