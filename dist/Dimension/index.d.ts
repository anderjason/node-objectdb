import { Observable, ReadOnlyObservable } from "@anderjason/observable";
import { Actor } from "skytree";
import { Entry, MongoDb, ObjectDb } from "..";
import { Bucket } from "./Bucket";
export interface PortableDimension {
    type: string;
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
    db: MongoDb;
    private _saveLater;
    constructor(props: TP);
    onActivate(): void;
    abstract load(): Promise<void>;
    abstract deleteEntryKey(entryKey: string): Promise<void>;
    abstract entryDidChange(entry: Entry<T>): Promise<void>;
    save(): Promise<void>;
    toOptionalBucketGivenKey(key: string): Bucket<T> | undefined;
    toBuckets(): IterableIterator<Bucket<T>>;
    addBucket(bucket: Bucket<T>): void;
    toPortableObject(): PortableDimension;
}
