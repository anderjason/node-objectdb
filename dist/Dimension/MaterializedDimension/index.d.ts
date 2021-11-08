import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { MaterializedBucket } from "./MaterializedBucket";
export interface MaterializedDimensionProps<T> {
    key: string;
    label: string;
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => undefined | BucketIdentifier | BucketIdentifier[];
}
export declare class MaterializedDimension<T> extends PropsObject<MaterializedDimensionProps<T>> implements Dimension<T> {
    private _db;
    private _stopwatch;
    get key(): string;
    get label(): string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<Bucket | undefined>;
    toBuckets(): Promise<MaterializedBucket<T>[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private addEntryToBucket;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
