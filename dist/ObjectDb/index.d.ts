import { Dict, Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { Actor } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { MetricResult } from "../Metric";
import { MongoDb } from "../MongoDb";
import { Property, PropertyDefinition } from "../Property";
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
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    readonly collectionDidChange: TypedEvent<void>;
    readonly entryWillChange: TypedEvent<EntryChange<T>>;
    readonly entryDidChange: TypedEvent<EntryChange<T>>;
    protected _isLoaded: Observable<boolean>;
    readonly isLoaded: ReadOnlyObservable<boolean>;
    private _dimensions;
    private _propertyByKey;
    private _caches;
    private _mutexByEntryKey;
    private _db;
    get mongoDb(): MongoDb;
    onActivate(): void;
    private load;
    ensureIdle(): Promise<MetricResult<void>>;
    runExclusive<T = void>(entryKey: string, fn: () => Promise<MetricResult<T>> | MetricResult<T>): Promise<MetricResult<T>>;
    updateEntryKey(entryKey: string, partialData: Partial<T>): Promise<MetricResult<Entry<T>>>;
    private allEntryKeys;
    toEntryKeys(options?: ObjectDbReadOptions): Promise<MetricResult<AsyncGenerator<string>>>;
    forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void>;
    hasEntry(entryKey: string): Promise<MetricResult<boolean>>;
    toEntryCount(filter?: BucketIdentifier[], cacheKey?: string): Promise<MetricResult<number>>;
    toEntries(options?: ObjectDbReadOptions): Promise<MetricResult<AsyncGenerator<Entry<T>>>>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<MetricResult<Entry<T> | undefined>>;
    toEntryGivenKey(entryKey: string): Promise<MetricResult<Entry<T>>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<MetricResult<Entry<T> | undefined>>;
    toDimensions(): Promise<MetricResult<Dimension<T>[]>>;
    writeProperty(definition: PropertyDefinition): Promise<void>;
    deletePropertyKey(propertyKey: string): Promise<void>;
    toOptionalPropertyGivenKey(key: string): Promise<Property | undefined>;
    toProperties(): Promise<Property[]>;
    rebuildMetadataGivenEntry(entry: Entry<T>): Promise<MetricResult<void>>;
    rebuildMetadata(): SlowResult<any>;
    toBuckets(): Promise<MetricResult<AsyncGenerator<Bucket>>>;
    toBucketsGivenEntryKey(entryKey: string): SlowResult<BucketIdentifier>;
    toOptionalDimensionGivenKey(dimensionKey: string): Promise<MetricResult<Dimension<T> | undefined>>;
    toOptionalBucketGivenIdentifier(bucketIdentifier: BucketIdentifier): Promise<MetricResult<Bucket | undefined>>;
    writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<MetricResult<void>>;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant, documentVersion?: number): Promise<MetricResult<Entry<T>>>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
}
