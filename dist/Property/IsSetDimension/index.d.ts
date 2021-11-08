import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../Dimension";
import { Entry, MongoDb } from "../..";
import { SelectProperty } from "../Select/SelectProperty";
export interface IsSetDimensionProps {
    property: SelectProperty;
}
export declare class IsSetDimension<T> extends PropsObject<IsSetDimensionProps> implements Dimension<T> {
    private _db;
    private _stopwatch;
    get key(): string;
    get label(): string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<Bucket | undefined>;
    deleteBucketKey(bucketKey: string): Promise<void>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): AsyncGenerator<Bucket>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
