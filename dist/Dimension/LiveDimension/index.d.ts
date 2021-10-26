import { Stopwatch } from "@anderjason/time";
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
    dimensionLabel: string;
    propertyName: string;
    propertyType: "value" | "array";
    dimensionKey?: string;
    labelGivenKey?: (key: string) => string;
    mongoValueGivenBucketKey?: (bucketKey: string) => any;
}
export declare class LiveDimension<T> extends PropsObject<LiveDimensionProps<T>> implements Dimension<T> {
    static ofEntry<T>(params: LiveDimensionOfEntryParams): LiveDimension<T>;
    get key(): string;
    get label(): string;
    db: MongoDb;
    stopwatch: Stopwatch;
    toOptionalBucketGivenKey(bucketKey: string): Promise<Bucket | undefined>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): Promise<LiveBucket<T>[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
