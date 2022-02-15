import { UniqueId } from "@anderjason/node-crypto";
import {
  Dict,
  Observable,
  ReadOnlyObservable,
  TypedEvent,
} from "@anderjason/observable";
import { Duration, Instant, Stopwatch } from "@anderjason/time";
import { ArrayUtil, ObjectUtil, SetUtil, StringUtil } from "@anderjason/util";
import { Mutex } from "async-mutex";
import { Actor, Timer } from "skytree";
import {
  Bucket,
  BucketIdentifier,
  Dimension,
  hashCodeGivenBucketIdentifier,
} from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { MongoDb } from "../MongoDb";
import {
  Property,
  PropertyDefinition,
  propertyGivenDefinition,
} from "../Property";
import { SelectProperty } from "../Property/Select/SelectProperty";
import { SlowResult } from "../SlowResult";

export interface Order {
  key: string;
  direction: "ascending" | "descending";
}

export interface ObjectDbReadOptions {
  filter?: BucketIdentifier[];
  limit?: number;
  offset?: number;
  cacheKey?: string;
  shuffle?: boolean;
}

export interface ObjectDbProps<T> {
  label: string;
  db: MongoDb;

  cacheSize?: number;
  rebuildBucketSize?: number;
  dimensions?: Dimension<T>[];
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

export async function arrayGivenAsyncIterable<T>(
  asyncIterable: AsyncIterable<T>
): Promise<T[]> {
  const result: T[] = [];

  for await (const item of asyncIterable) {
    result.push(item);
  }

  return result;
}

export async function countGivenAsyncIterable<T>(
  asyncIterable: AsyncIterable<T>
): Promise<number> {
  let result: number = 0;

  for await (const item of asyncIterable) {
    result += 1;
  }

  return result;
}

export async function optionalFirstGivenAsyncIterable<T>(
  asyncIterable: AsyncIterable<T>
): Promise<T> {
  const iterator = asyncIterable[Symbol.asyncIterator]();
  const r = await iterator.next();
  return r.value;
}

export class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
  readonly collectionDidChange = new TypedEvent();
  readonly entryWillChange = new TypedEvent<EntryChange<T>>();
  readonly entryDidChange = new TypedEvent<EntryChange<T>>();

  protected _isLoaded = Observable.givenValue(false, Observable.isStrictEqual);
  readonly isLoaded = ReadOnlyObservable.givenObservable(this._isLoaded);

  readonly stopwatch = new Stopwatch(this.props.label);

  private _dimensions: Dimension<T>[] = [];
  private _propertyByKey: Map<string, Property> = new Map();
  private _caches = new Map<number, CacheData>();
  private _mutexByEntryKey = new Map<string, Mutex>();
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

    await this._db.isConnected.toPromise((v) => v);

    if (this.props.dimensions != null) {
      for (const dimension of this.props.dimensions) {
        await dimension.init(this._db, this.stopwatch);

        this._dimensions.push(dimension);
      }
    }

    const propertyDefinitions = await this._db
      .collection<PropertyDefinition>("properties")
      .find(
        {},
        {
          projection: { _id: 0 },
        }
      )
      .toArray();

    for (const propertyDefinition of propertyDefinitions) {
      const property = propertyGivenDefinition(propertyDefinition);
      this._propertyByKey.set(propertyDefinition.key, property);
    }

    this._isLoaded.setValue(true);
  }

  async ensureIdle(): Promise<void> {
    // console.log(`Waiting for ObjectDB idle in ${this.props.label}...`);
    await this._isLoaded.toPromise((v) => v);

    // console.log(`ObjectDb is idle in ${this.props.label}`);
  }

  async runExclusive(
    entryKey: string,
    fn: () => Promise<void> | void
  ): Promise<void> {
    if (entryKey == null) {
      throw new Error("entryKey is required");
    }

    if (fn == null) {
      throw new Error("fn is required");
    }

    if (!this._mutexByEntryKey.has(entryKey)) {
      this._mutexByEntryKey.set(entryKey, new Mutex());
    }

    const mutex = this._mutexByEntryKey.get(entryKey);

    try {
      await mutex.runExclusive(async () => {
        await fn();
      });
    } finally {
      if (mutex.isLocked() == false) {
        this._mutexByEntryKey.delete(entryKey);
      }
    }
  }

  private async *allEntryKeys(): AsyncGenerator<string> {
    const entries = this._db.collection<PortableEntry<any>>("entries").find(
      {},
      {
        projection: { key: 1 },
      }
    );

    for await (const document of entries) {
      yield document.key;
    }
  }

  async *toEntryKeys(
    options: ObjectDbReadOptions = {}
  ): AsyncGenerator<string> {
    const now = Instant.ofNow();

    let entryKeys: string[] = undefined;

    await this.ensureIdle();

    let fullCacheKey: number = undefined;
    if (options.cacheKey != null) {
      const bucketIdentifiers: BucketIdentifier[] = options.filter ?? [];
      const buckets: Bucket[] = [];

      for (const bucketIdentifier of bucketIdentifiers) {
        const bucket = await this.toOptionalBucketGivenIdentifier(
          bucketIdentifier
        );
        if (bucket != null) {
          buckets.push(bucket);
        }
      }

      const hashCodes = buckets.map((bucket) =>
        hashCodeGivenBucketIdentifier(bucket.identifier)
      );

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
        entryKeys = await arrayGivenAsyncIterable(this.allEntryKeys());
      } else {
        const sets: Set<string>[] = [];

        for (const bucketIdentifier of options.filter) {
          const bucket = await this.toOptionalBucketGivenIdentifier(
            bucketIdentifier
          );
          if (bucket == null) {
            sets.push(new Set<string>());
          } else {
            const entryKeys: Set<string> = await bucket.toEntryKeys();
            sets.push(entryKeys);
          }
        }

        entryKeys = Array.from(SetUtil.intersectionGivenSets(sets));
      }

      if (options.shuffle == true) {
        entryKeys = ArrayUtil.arrayWithOrderFromValue(
          entryKeys,
          (e) => Math.random(),
          "ascending"
        );
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

    for (const i of result) {
      yield i;
    }
  }

  // TC: O(N)
  async forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void> {
    const entryKeys = this.allEntryKeys();
    for await (const entryKey of entryKeys) {
      const entry = await this.toOptionalEntryGivenKey(entryKey);
      await fn(entry);
    }
  }

  async hasEntry(entryKey: string): Promise<boolean> {
    const keys = await arrayGivenAsyncIterable(this.toEntryKeys());
    return keys.includes(entryKey);
  }

  async toEntryCount(filter?: BucketIdentifier[]): Promise<number> {
    return countGivenAsyncIterable(
      this.toEntryKeys({
        filter,
      })
    );
  }

  async *toEntries(
    options: ObjectDbReadOptions = {}
  ): AsyncGenerator<Entry<T>> {
    for await (const entryKey of this.toEntryKeys(options)) {
      const entry = await this.toOptionalEntryGivenKey(entryKey);
      if (entry != null) {
        yield entry;
      }
    }
  }

  async toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Promise<Entry<T> | undefined> {
    return optionalFirstGivenAsyncIterable(
      this.toEntries({
        ...options,
        limit: 1,
      })
    );
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

  async toDimensions(): Promise<Dimension<T>[]> {
    const result = [...this._dimensions];

    for (const property of this._propertyByKey.values()) {
      const propertyDimensions = await property.toDimensions();
      propertyDimensions.forEach((dimension) => {
        result.push(dimension);
      });
    }

    for (const dimension of result) {
      await dimension.init(this._db, this.stopwatch);
    }

    return result;
  }

  async writeProperty(definition: PropertyDefinition): Promise<void> {
    let property: Property;

    switch (definition.propertyType) {
      case "select":
        property = await SelectProperty.writeDefinition(this._db, definition);
        break;
      default:
        throw new Error(
          `Unsupported property type '${definition.propertyType}'`
        );
    }

    this._propertyByKey.set(definition.key, property);
  }

  async deletePropertyKey(propertyKey: string): Promise<void> {
    await this._db.collection("properties").deleteOne({ key: propertyKey });

    const fullPropertyPath = `propertyValues.${propertyKey}`;
    await this.props.db.collection("buckets").updateMany(
      { [fullPropertyPath]: { $exists: true } },
      {
        $unset: { [fullPropertyPath]: 1 },
      }
    );

    this._propertyByKey.delete(propertyKey);
  }

  async toOptionalPropertyGivenKey(key: string): Promise<Property | undefined> {
    return this._propertyByKey.get(key);
  }

  async toProperties(): Promise<Property[]> {
    return Array.from(this._propertyByKey.values());
  }

  async rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void> {
    const timer = this.stopwatch.start("rebuildMetadataGivenEntry");
    const dimensions = await this.toDimensions();

    await Promise.all(
      dimensions.map((dimension) => dimension.rebuildEntry(entry))
    );
    timer.stop();
  }

  rebuildMetadata(): SlowResult<any> {
    console.log(`Rebuilding metadata for ${this.props.label}...`);

    return new SlowResult({
      getItems: () => this.allEntryKeys(),
      getTotalCount: () => this.toEntryCount(),
      fn: async (entryKey) => {
        const entry = await this.toOptionalEntryGivenKey(entryKey);
        if (entry == null) {
          return;
        }

        await this.rebuildMetadataGivenEntry(entry);
      },
    });
  }

  async *toBuckets(): AsyncGenerator<Bucket> {
    const dimensions = await this.toDimensions();
    for await (const dimension of dimensions) {
      for await (const bucket of dimension.toBuckets()) {
        yield bucket;
      }
    }
  }

  toBucketsGivenEntryKey(entryKey: string): SlowResult<BucketIdentifier> {
    return new SlowResult({
      getItems: () => this.toBuckets(),
      fn: async (bucket) => {
        const hasItem = await bucket.hasEntryKey(entryKey);
        return hasItem ? bucket.identifier : undefined;
      },
    });
  }

  async toOptionalDimensionGivenKey(
    dimensionKey: string
  ): Promise<Dimension<T> | undefined> {
    if (dimensionKey == null) {
      return undefined;
    }

    const dimensions = await this.toDimensions();
    return dimensions.find((d) => d.key === dimensionKey);
  }

  async toOptionalBucketGivenIdentifier(
    bucketIdentifier: BucketIdentifier
  ): Promise<Bucket | undefined> {
    const dimension = await this.toOptionalDimensionGivenKey(
      bucketIdentifier.dimensionKey
    );
    if (dimension == null) {
      return undefined;
    }

    return dimension.toOptionalBucketGivenKey(
      bucketIdentifier.bucketKey,
      bucketIdentifier.bucketLabel
    );
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
            entry.createdAt,
            entry.documentVersion
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
            createdAt,
            entry.documentVersion
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
    createdAt?: Instant,
    documentVersion?: number
  ): Promise<Entry<T>> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    let entry = await this.toOptionalEntryGivenKey(entryKey);

    const oldDocumentVersion = entry?.documentVersion;
    if (
      oldDocumentVersion != null &&
      documentVersion != null &&
      oldDocumentVersion !== documentVersion
    ) {
      console.log("key", entryKey);
      console.log("old version", oldDocumentVersion, entry?.data);
      console.log("new version", documentVersion, entryData);

      throw new Error("Document version does not match");
    }

    const oldPortableEntry = entry?.toPortableEntry();
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
    await this.rebuildMetadataGivenEntry(entry);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }

    this.entryDidChange.emit(change);

    await this.ensureIdle();

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

    const dimensions = await this.toDimensions();
    for (const dimension of dimensions) {
      await dimension.deleteEntryKey(entryKey);
    }

    await this._db.collection("entries").deleteOne({ key: entryKey });

    this.entryDidChange.emit(change);
    this.collectionDidChange.emit();
  }
}
