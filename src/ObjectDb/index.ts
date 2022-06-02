import { UniqueId } from "@anderjason/node-crypto";
import {
  Dict,
  Observable,
  ReadOnlyObservable,
  TypedEvent,
} from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import {
  ArrayUtil,
  IterableUtil,
  ObjectUtil,
  SetUtil,
  StringUtil,
} from "@anderjason/util";
import { Mutex } from "async-mutex";
import { Actor } from "skytree";
import {
  Bucket,
  BucketIdentifier,
  Dimension,
  hashCodeGivenBucketIdentifier,
} from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { Metric, MetricResult } from "../Metric";
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
  entryKeys: string[];
}

export class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
  readonly collectionDidChange = new TypedEvent();
  readonly entryWillChange = new TypedEvent<EntryChange<T>>();
  readonly entryDidChange = new TypedEvent<EntryChange<T>>();

  protected _isLoaded = Observable.givenValue(false, Observable.isStrictEqual);
  readonly isLoaded = ReadOnlyObservable.givenObservable(this._isLoaded);

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

    this.load();
  }

  private async load(): Promise<void> {
    if (this.isActive == false) {
      return;
    }

    await this._db.isConnected.toPromise((v) => v);

    if (this.props.dimensions != null) {
      for (const dimension of this.props.dimensions) {
        await dimension.init(this._db);

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

  async ensureIdle(): Promise<MetricResult<void>> {
    const metric = new Metric("ensureIdle");

    await this._isLoaded.toPromise((v) => v);

    return new MetricResult(metric, undefined);
  }

  async runExclusive<T = void>(
    entryKey: string,
    fn: () => Promise<MetricResult<T>> | MetricResult<T>
  ): Promise<MetricResult<T>> {
    if (entryKey == null) {
      throw new Error("entryKey is required");
    }

    if (fn == null) {
      throw new Error("fn is required");
    }

    const metric = new Metric("runExclusive");

    if (!this._mutexByEntryKey.has(entryKey)) {
      this._mutexByEntryKey.set(entryKey, new Mutex());
    }

    const mutex = this._mutexByEntryKey.get(entryKey)!;

    try {
      return mutex.runExclusive(async () => {
        const fnResult = await fn();
        metric.addChildMetric(fnResult.metric);
        const result = fnResult.value;

        return new MetricResult(metric, result);
      });
    } finally {
      if (mutex.isLocked() == false) {
        this._mutexByEntryKey.delete(entryKey);
      }
    }
  }

  async updateEntryKey(
    entryKey: string,
    partialData: Partial<T>
  ): Promise<MetricResult<Entry<T>>> {
    if (entryKey == null) {
      throw new Error("entryKey is required");
    }

    if (partialData == null) {
      throw new Error("partialData is required");
    }

    return this.runExclusive<Entry<T>>(entryKey, async () => {
      const metric = new Metric("updateEntryKey");

      const entryResult = await this.toEntryGivenKey(entryKey);
      if (entryResult.value == null) {
        throw new Error("Entry not found in updateEntryKey");
      }

      const entry = entryResult.value;
      metric.addChildMetric(entryResult.metric);

      Object.assign(entry.data, partialData);

      entry.status = "updated";
      const writeResult = await this.writeEntry(entry);
      metric.addChildMetric(writeResult.metric);

      return new MetricResult(metric, entry);
    });
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
    let entryKeys: string[] | undefined = undefined;

    await this.ensureIdle();

    let fullCacheKey: number | undefined = undefined;
    if (options.cacheKey != null) {
      const bucketIdentifiers: BucketIdentifier[] = options.filter ?? [];
      const buckets: Bucket[] = [];

      for (const bucketIdentifier of bucketIdentifiers) {
        const bucketResult = await this.toOptionalBucketGivenIdentifier(
          bucketIdentifier
        );
        const bucket = bucketResult.value;

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
        entryKeys = cacheData.entryKeys;
      }
    }

    if (entryKeys == null) {
      if (ArrayUtil.arrayIsEmptyOrNull(options.filter)) {
        entryKeys = await IterableUtil.arrayGivenAsyncIterable(
          this.allEntryKeys()
        );
      } else {
        const sets: Set<string>[] = [];

        for (const bucketIdentifier of options.filter!) {
          const bucketResult = await this.toOptionalBucketGivenIdentifier(
            bucketIdentifier
          );
          const bucket = bucketResult.value;

          if (bucket == null) {
            sets.push(new Set<string>());
          } else {
            const entryKeysResult = await bucket.toEntryKeys();
            const entryKeys = entryKeysResult.value;

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

    if (
      options.cacheKey != null &&
      fullCacheKey != null &&
      !this._caches.has(fullCacheKey)
    ) {
      this._caches.set(fullCacheKey, {
        entryKeys,
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
      const entryResult = await this.toOptionalEntryGivenKey(entryKey);
      const entry = entryResult.value;

      if (entry != null) {
        await fn(entry);
      }
    }
  }

  async hasEntry(entryKey: string): Promise<boolean> {
    const keys = await IterableUtil.arrayGivenAsyncIterable(this.toEntryKeys());
    return keys.includes(entryKey);
  }

  async toEntryCount(
    filter?: BucketIdentifier[],
    cacheKey?: string
  ): Promise<number> {
    return IterableUtil.countGivenAsyncIterable(
      this.toEntryKeys({
        filter,
        cacheKey,
      })
    );
  }

  async *toEntries(
    options: ObjectDbReadOptions = {}
  ): AsyncGenerator<Entry<T>> {
    for await (const entryKey of this.toEntryKeys(options)) {
      const entryResult = await this.toOptionalEntryGivenKey(entryKey);
      const entry = entryResult.value;

      if (entry != null) {
        yield entry;
      }
    }
  }

  async toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Promise<Entry<T> | undefined> {
    return IterableUtil.optionalNthValueGivenAsyncIterable(
      this.toEntries({
        ...options,
        limit: 1,
      }),
      0
    );
  }

  async toEntryGivenKey(entryKey: string): Promise<MetricResult<Entry<T>>> {
    const entryResult = await this.toOptionalEntryGivenKey(entryKey);
    const entry = entryResult.value;

    if (entry == null) {
      throw new Error(`Entry not found for key '${entryKey}'`);
    }

    return new MetricResult(entryResult.metric, entry);
  }

  async toOptionalEntryGivenKey(
    entryKey: string
  ): Promise<MetricResult<Entry<T> | undefined>> {
    if (entryKey == null) {
      throw new Error("Entry key is required");
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const metric = new Metric("toOptionalEntryGivenKey");

    const result: Entry<T> = new Entry<T>({
      key: entryKey,
      db: this._db,
      objectDb: this,
    });

    const didLoadResult = await result.load();
    metric.addChildMetric(didLoadResult.metric);

    if (!didLoadResult.value) {
      return new MetricResult(metric, undefined);
    }

    return new MetricResult(metric, result);
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
      await dimension.init(this._db);
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

  async rebuildMetadataGivenEntry(
    entry: Entry<T>
  ): Promise<MetricResult<void>> {
    const metric = new Metric("rebuildMetadataGivenEntry");

    const dimensions = await this.toDimensions();

    const metricResults = await Promise.all(
      dimensions.map((dimension) => dimension.rebuildEntry(entry))
    );

    for (const metricResult of metricResults) {
      metric.addChildMetric(metricResult.metric);
    }

    return new MetricResult(metric, undefined);
  }

  rebuildMetadata(): SlowResult<any> {
    console.log(`Rebuilding metadata for ${this.props.label}...`);

    return new SlowResult({
      getItems: () => this.allEntryKeys(),
      getTotalCount: () => this.toEntryCount(),
      fn: async (entryKey) => {
        const entryResult = await this.toOptionalEntryGivenKey(entryKey);
        const entry = entryResult.value;

        if (entry != null) {
          const rebuildResult = await this.rebuildMetadataGivenEntry(entry);
          console.log(JSON.stringify(rebuildResult, null, 2));
        }
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
  ): Promise<MetricResult<Bucket | undefined>> {
    const dimension = await this.toOptionalDimensionGivenKey(
      bucketIdentifier.dimensionKey
    );
    if (dimension == null) {
      return new MetricResult(undefined, undefined);
    }

    return dimension.toOptionalBucketGivenKey(
      bucketIdentifier.bucketKey,
      bucketIdentifier.bucketLabel
    );
  }

  async writeEntry(
    entry: Entry<T> | PortableEntry<T>
  ): Promise<MetricResult<void>> {
    if (entry == null) {
      throw new Error("Entry is required");
    }

    switch (entry.status) {
      case "deleted":
        return this.deleteEntryKey(entry.key);
      case "new":
      case "saved":
      case "updated":
      case "unknown":
        if ("createdAt" in entry) {
          const writeResult = await this.writeEntryData(
            entry.data,
            entry.propertyValues,
            entry.key,
            entry.createdAt,
            entry.documentVersion
          );
          return new MetricResult(writeResult.metric, undefined);
        } else {
          const createdAtEpochMs = (entry as PortableEntry<T>).createdAtEpochMs;
          const createdAt =
            createdAtEpochMs != null
              ? Instant.givenEpochMilliseconds(createdAtEpochMs)
              : undefined;

          const writeResult = await this.writeEntryData(
            entry.data,
            entry.propertyValues,
            entry.key,
            createdAt,
            entry.documentVersion
          );
          return new MetricResult(writeResult.metric, undefined);
        }
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
  ): Promise<MetricResult<Entry<T>>> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const metric = new Metric("writeEntryData");

    const entryResult = await this.toOptionalEntryGivenKey(entryKey);
    let entry = entryResult.value;
    metric.addChildMetric(entryResult.metric);

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
      return new MetricResult(metric, entry!);
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

    const saveResult = await entry.save();
    metric.addChildMetric(saveResult.metric);

    const rebuildResult = await this.rebuildMetadataGivenEntry(entry);
    metric.addChildMetric(rebuildResult.metric);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }

    this.entryDidChange.emit(change);

    const ensureIdleResult = await this.ensureIdle();
    metric.addChildMetric(ensureIdleResult.metric);

    return new MetricResult(metric, entry);
  }

  async deleteEntryKey(entryKey: string): Promise<MetricResult<void>> {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const metric = new Metric("deleteEntryKey");

    const existingRecordResult = await this.toOptionalEntryGivenKey(entryKey);
    const existingRecord = existingRecordResult.value;
    metric.addChildMetric(existingRecordResult.metric);

    if (existingRecord == null) {
      return new MetricResult(metric, undefined);
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

    return new MetricResult(metric, undefined);
  }
}
