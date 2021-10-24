import { UniqueId } from "@anderjason/node-crypto";
import {
  Dict,
  Observable,
  ReadOnlyObservable,
  TypedEvent,
} from "@anderjason/observable";
import { Duration, Instant } from "@anderjason/time";
import { ArrayUtil, ObjectUtil, SetUtil, StringUtil } from "@anderjason/util";
import { Actor, Timer } from "skytree";
import { Benchmark } from "../Benchmark";
import {
  Dimension,
  DimensionProps,
} from "../Dimension";
import { AbsoluteBucketIdentifier, Bucket } from "../Dimension/Bucket";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { MongoDb } from "../MongoDb";

export interface Order {
  key: string;
  direction: "ascending" | "descending";
}

export interface ObjectDbReadOptions {
  filter?: AbsoluteBucketIdentifier[];
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface ObjectDbProps<T> {
  label: string;
  db: MongoDb;

  cacheSize?: number;
  dimensions?: Dimension<T, DimensionProps>[];
}

export interface EntryChange<T> {
  key: string;
  entry: Entry<T>;

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
  private _caches = new Map<number, CacheData>();

  private _db: MongoDb;

  get mongoDb(): MongoDb {
    return this._db;
  }

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

  private async load(): Promise<void> {
    if (this.isActive == false) {
      return;
    }

    const db = this._db;

    console.log("Waiting for db connection...");
    await this._db.isConnected.toPromise((v) => v);
    console.log("DB is connected");
    
    // db.toRows("SELECT key, definition FROM properties").forEach((row) => {
    //   const { key, definition } = row;

    //   // assign property definitions
    //   this._properties.set(key, JSON.parse(definition));
    // });

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

  async ensureDimensionsIdle(): Promise<void> {
    // wait for all dimensions to be updated
    const dimensions = Array.from(this._dimensionsByKey.values());

    console.log("Waiting for all dimensions to be updated...");
    await Promise.all(dimensions.map(d => d.isUpdated.toPromise(v => v)));
    console.log("Dimensions are all updated");
  }

  async ensureIdle(): Promise<void> {
    console.log("Waiting for idle...");
    await Promise.all([
      this._isLoaded.toPromise(v => v),
      this.ensureDimensionsIdle()
    ]);
    console.log("ObjectDb is idle");
  }

  async save(): Promise<void> {
    for (const dimension of this._dimensionsByKey.values()) {
      await dimension.save();
    }
  }

  private async allEntryKeys(): Promise<string[]> {
    const entries = await this._db
      .collection<PortableEntry<T>>("entries")
      .find(
        {},
        {
          projection: { key: 1 },
        }
      )
      .toArray();

    return entries.map((row) => row.key);
  }

  async toEntryKeys(options: ObjectDbReadOptions = {}): Promise<string[]> {
    const now = Instant.ofNow();

    let entryKeys: string[] = undefined;

    await this.ensureIdle();

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

      const cacheKeyData = `${options.cacheKey}:${hashCodes.join(",")}`;
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
      if (ArrayUtil.arrayIsEmptyOrNull(options.filter)) {
        entryKeys = await this.allEntryKeys();
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
    const entryKeys = await this.allEntryKeys();
    for (const entryKey of entryKeys) {
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
  }

  async rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void> {
    for (const dimension of this._dimensionsByKey.values()) {
      await dimension.rebuildEntry(entry);
    }
  }

  async rebuildMetadata(): Promise<void> {
    console.log(`Rebuilding metadata for ${this.props.label}...`);

    let remainingCount: number = await this._db
      .collection<PortableEntry<T>>("entries")
      .countDocuments();

    const benchmark = new Benchmark(remainingCount);
    await this.forEach(async (entry) => {
      benchmark.log(`Rebuilding ${entry.key}`);
      await this.rebuildMetadataGivenEntry(entry);

      remainingCount -= 1;
    });

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

    const change: EntryChange<T> = {
      key: entryKey,
      entry,
      oldData,
      newData: entryData,
    };

    this.entryWillChange.emit(change);

    await entry.save();

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
      entry: existingRecord,
      oldData: existingRecord.data,
    };

    this.entryWillChange.emit(change);

    await this.removeMetadataGivenEntryKey(entryKey);

    await this._db.collection("entries").deleteOne({ key: entryKey });

    this.entryDidChange.emit(change);
    this.collectionDidChange.emit();
  }
}
