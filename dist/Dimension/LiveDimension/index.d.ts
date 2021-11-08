import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { LiveBucket } from "./LiveBucket";
export interface LiveDimensionProps<T> {
    key: string;
    label: string;
    mongoFilterGivenBucketIdentifier: (identifier: BucketIdentifier) => any;
    allBucketIdentifiers: (db: MongoDb) => Promise<BucketIdentifier[]>;
}
export interface LiveDimensionOfEntryParams {
    dimensionKey: string;
    dimensionLabel: string;
    valuePath: ValuePath<any>;
    valueType: "single" | "array";
    labelGivenKey?: (key: string) => string;
    mongoValueGivenBucketKey?: (bucketKey: string) => any;
}
export declare class LiveDimension<T> extends PropsObject<LiveDimensionProps<T>> implements Dimension<T> {
    static ofEntry<T>(params: LiveDimensionOfEntryParams): LiveDimension<T>;
    private _db;
    private _stopwatch;
    get key(): string;
    get label(): string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<Bucket | undefined>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): Promise<LiveBucket<T>[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
