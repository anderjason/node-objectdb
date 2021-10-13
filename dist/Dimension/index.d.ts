import { Observable, ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Actor } from "skytree";
import { Entry, ObjectDb } from "..";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";
export interface BucketProps<T> {
    identifier: RelativeBucketIdentifier;
    dimension: Dimension<T, DimensionProps>;
    storage?: any;
}
export declare abstract class Bucket<T> extends Actor<BucketProps<T>> {
    readonly key: string;
    readonly label: string;
    constructor(props: BucketProps<T>);
    onActivate(): void;
    readonly didChange: TypedEvent<void>;
    abstract hasEntryKey(entryKey: string): Promise<boolean>;
    abstract toPortableObject(): PortableBucket;
    abstract toEntryKeys(): Promise<Set<string>>;
    toBucketIdentifier(): AbsoluteBucketIdentifier;
    toHashCode(): number;
}
export interface RelativeBucketIdentifier {
    bucketKey: string;
    bucketLabel: string;
}
export interface AbsoluteBucketIdentifier extends RelativeBucketIdentifier {
    dimensionKey: string;
}
export interface PortableBucket {
    type: string;
    identifier: RelativeBucketIdentifier;
    storage?: any;
}
export interface PortableDimension {
    type: string;
    buckets: PortableBucket[];
}
export interface DimensionProps {
    key: string;
    label: string;
}
export declare abstract class Dimension<T, TP extends DimensionProps> extends Actor<TP> {
    protected _buckets: Map<string, Bucket<T>>;
    readonly key: string;
    protected _isUpdated: Observable<boolean>;
    readonly isUpdated: ReadOnlyObservable<boolean>;
    label: string;
    objectDb: ObjectDb<T>;
    db: DbInstance;
    private _saveLater;
    constructor(props: TP);
    onActivate(): void;
    load(): Promise<void>;
    abstract onLoad(data: PortableDimension): void;
    abstract deleteEntryKey(entryKey: string): Promise<void>;
    abstract entryDidChange(entryKey: string): Promise<void>;
    save(): Promise<void>;
    toOptionalBucketGivenKey(key: string): Bucket<T> | undefined;
    toBuckets(): IterableIterator<Bucket<T>>;
    addBucket(bucket: Bucket<T>): void;
    toPortableObject(): PortableDimension;
}
export interface MaterializedDimensionProps<T> extends DimensionProps {
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => RelativeBucketIdentifier[];
}
export declare class MaterializedDimension<T> extends Dimension<T, MaterializedDimensionProps<T>> {
    protected _bucketsByEntryKey: Map<string, Bucket<T>[]>;
    private _waitingForEntryKeys;
    onActivate(): void;
    onLoad(data: PortableDimension): void;
    entryDidChange(entryKey: string): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private rebuildEntry;
    rebuild(): Promise<void>;
}
export declare class MaterializedBucket<T> extends Bucket<T> {
    private _entryKeys;
    readonly entryKeys: ReadOnlySet<string>;
    onActivate(): void;
    toEntryKeys(): Promise<Set<string>>;
    hasEntryKey(entryKey: string): Promise<boolean>;
    addEntryKey(entryKey: string): void;
    deleteEntryKey(entryKey: string): void;
    toPortableObject(): PortableBucket;
}
