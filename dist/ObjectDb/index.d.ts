import { Dict, Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { Actor } from "skytree";
import { AbsoluteBucketIdentifier, Bucket, Dimension, DimensionProps } from "../Dimension";
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
export declare type PropertyDefinition = SelectPropertyDefinition;
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    readonly collectionDidChange: TypedEvent<void>;
    readonly entryWillChange: TypedEvent<EntryChange<T>>;
    readonly entryDidChange: TypedEvent<EntryChange<T>>;
    protected _isLoaded: Observable<boolean>;
    readonly isLoaded: ReadOnlyObservable<boolean>;
    private _dimensionsByKey;
    private _caches;
    private _db;
    get mongoDb(): MongoDb;
    onActivate(): void;
    private load;
    save(): Promise<void>;
    private allEntryKeys;
    toEntryKeys(options?: ObjectDbReadOptions): Promise<string[]>;
    forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void>;
    hasEntry(entryKey: string): Promise<boolean>;
    toEntryCount(filter?: AbsoluteBucketIdentifier[]): Promise<number>;
    toEntries(options?: ObjectDbReadOptions): Promise<Entry<T>[]>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<Entry<T> | undefined>;
    toEntryGivenKey(entryKey: string): Promise<Entry<T>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined>;
    toDimensions(): IterableIterator<Dimension<T, DimensionProps>>;
    setProperty(property: PropertyDefinition): Promise<void>;
    deletePropertyKey(key: string): Promise<void>;
    toPropertyGivenKey(key: string): Promise<PropertyDefinition>;
    toProperties(): Promise<PropertyDefinition[]>;
    removeMetadataGivenEntryKey(entryKey: string): Promise<void>;
    rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void>;
    rebuildMetadata(): Promise<void>;
    toOptionalBucketGivenIdentifier(bucketIdentifier: AbsoluteBucketIdentifier): Bucket<T> | undefined;
    writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<void>;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant): Promise<Entry<T>>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
export {};
