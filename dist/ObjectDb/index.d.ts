import { Dict, Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Instant, Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
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
export declare function arrayGivenAsyncIterable<T>(asyncIterable: AsyncIterable<T>): Promise<T[]>;
export declare function countGivenAsyncIterable<T>(asyncIterable: AsyncIterable<T>): Promise<number>;
export declare function optionalFirstGivenAsyncIterable<T>(asyncIterable: AsyncIterable<T>): Promise<T>;
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    readonly collectionDidChange: TypedEvent<void>;
    readonly entryWillChange: TypedEvent<EntryChange<T>>;
    readonly entryDidChange: TypedEvent<EntryChange<T>>;
    protected _isLoaded: Observable<boolean>;
    readonly isLoaded: ReadOnlyObservable<boolean>;
    readonly stopwatch: Stopwatch;
    private _dimensions;
    private _propertyByKey;
    private _caches;
    private _db;
    get mongoDb(): MongoDb;
    onActivate(): void;
    private load;
    ensureIdle(): Promise<void>;
    private allEntryKeys;
    toEntryKeys(options?: ObjectDbReadOptions): AsyncGenerator<string>;
    forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void>;
    hasEntry(entryKey: string): Promise<boolean>;
    toEntryCount(filter?: BucketIdentifier[]): Promise<number>;
    toEntries(options?: ObjectDbReadOptions): AsyncGenerator<Entry<T>>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<Entry<T> | undefined>;
    toEntryGivenKey(entryKey: string): Promise<Entry<T>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined>;
    toDimensions(): Promise<Dimension<T>[]>;
    writeProperty(definition: PropertyDefinition): Promise<void>;
    deletePropertyKey(propertyKey: string): Promise<void>;
    toOptionalPropertyGivenKey(key: string): Promise<Property | undefined>;
    toProperties(): Promise<Property[]>;
    rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void>;
    rebuildMetadata(): AsyncGenerator<void>;
    toBuckets(): AsyncGenerator<Bucket>;
    toBucketsGivenEntryKey(entryKey: string): SlowResult<BucketIdentifier>;
    toOptionalDimensionGivenKey(dimensionKey: string): Promise<Dimension<T> | undefined>;
    toOptionalBucketGivenIdentifier(bucketIdentifier: BucketIdentifier): Promise<Bucket | undefined>;
    writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<void>;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant): Promise<Entry<T>>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
