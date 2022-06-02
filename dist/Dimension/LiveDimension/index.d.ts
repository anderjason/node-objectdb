import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MetricResult, MongoDb } from "../..";
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
    get key(): string;
    get label(): string;
    init(db: MongoDb): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<MetricResult<Bucket | undefined>>;
    toBucketIdentifiers(): AsyncGenerator<BucketIdentifier>;
    toBuckets(): AsyncGenerator<LiveBucket<T>>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
    rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>>;
}
