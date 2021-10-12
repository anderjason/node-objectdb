import { LocalFile } from "@anderjason/node-filesystem";
import { Dict, Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Instant, Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { Dimension, DimensionProps, AbsoluteBucketIdentifier, Bucket } from "../Dimension";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { Metric } from "../Metric";
import { PortableTag } from "../Tag/PortableTag";
export interface Order {
    key: string;
    direction: "ascending" | "descending";
}
export declare type TagLookup = string | PortableTag;
export interface ObjectDbReadOptions {
    filter?: AbsoluteBucketIdentifier[];
    orderByMetric?: Order;
    limit?: number;
    offset?: number;
    cacheKey?: string;
}
export interface ObjectDbProps<T> {
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
    readonly stopwatch: Stopwatch;
    protected _isLoaded: Observable<boolean>;
    readonly isLoaded: ReadOnlyObservable<boolean>;
    private _dimensionsByKey;
    private _metrics;
    private _properties;
    private _entryKeys;
    private _caches;
    private _db;
    constructor(props: ObjectDbProps<T>);
    onActivate(): void;
    get metrics(): Metric[];
    private load;
    toEntryKeys(options?: ObjectDbReadOptions): Promise<string[]>;
    forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void>;
    hasEntry(entryKey: string): Promise<boolean>;
    runTransaction(fn: () => Promise<void>): Promise<void>;
    toEntryCount(filter?: AbsoluteBucketIdentifier[]): Promise<number>;
    toEntries(options?: ObjectDbReadOptions): Promise<Entry<T>[]>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<Entry<T> | undefined>;
    toEntryGivenKey(entryKey: string): Promise<Entry<T>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined>;
    setProperty(property: PropertyDefinition): Promise<void>;
    deletePropertyKey(key: string): Promise<void>;
    toPropertyGivenKey(key: string): Promise<PropertyDefinition>;
    toProperties(): Promise<PropertyDefinition[]>;
    removeMetadataGivenEntryKey(entryKey: string): Promise<void>;
    rebuildMetadata(): Promise<void>;
    toOptionalBucketGivenIdentifier(bucketIdentifier: AbsoluteBucketIdentifier): Bucket<T> | undefined;
    rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void>;
    writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<void>;
    metricGivenMetricKey(metricKey: string): Promise<Metric>;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant): Promise<Entry<T>>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
export {};
