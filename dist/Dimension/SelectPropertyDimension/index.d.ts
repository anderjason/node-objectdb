import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { SelectProperty } from "../../Property/SelectProperty";
import { LiveBucket } from "../LiveDimension/LiveBucket";
export interface SelectPropertyDimensionProps {
    property: SelectProperty;
}
export declare class SelectPropertyDimension<T> extends PropsObject<SelectPropertyDimensionProps> implements Dimension<T> {
    private _db;
    private _stopwatch;
    get key(): string;
    get label(): string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string): Promise<Bucket | undefined>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): Promise<LiveBucket<T>[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
