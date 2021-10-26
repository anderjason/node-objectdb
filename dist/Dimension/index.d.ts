import { Stopwatch } from "@anderjason/time";
import { Entry, MongoDb } from "..";
export interface Dimension<T> {
    readonly key: string;
    readonly label: string;
    init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
    rebuildEntry(entry: Entry<T>): Promise<void>;
    toOptionalBucketGivenKey(key: string): Promise<Bucket | undefined>;
    toBuckets(): Promise<Bucket[]>;
}
export interface BucketIdentifier {
    dimensionKey: string;
    bucketKey: string;
    bucketLabel: string;
}
export declare function hashCodeGivenBucketIdentifier(bucketIdentifier: BucketIdentifier): number;
export interface Bucket {
    readonly identifier: BucketIdentifier;
    hasEntryKey(entryKey: string): Promise<boolean>;
    toEntryKeys(): Promise<Set<string>>;
}
