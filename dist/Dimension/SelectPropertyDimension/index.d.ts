import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { SelectProperty } from "../../Property/SelectProperty";
export interface SelectPropertyDimensionProps {
    property: SelectProperty;
}
export declare class SelectPropertyDimension<T> extends PropsObject<SelectPropertyDimensionProps> implements Dimension<T> {
    private _db;
    private _stopwatch;
    get key(): string;
    get label(): string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<Bucket | undefined>;
    deleteBucketKey(bucketKey: string): Promise<void>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): Promise<Bucket[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
