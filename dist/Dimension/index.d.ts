import { Entry, MetricResult, MongoDb } from "..";
export interface Dimension<T> {
    readonly key: string;
    readonly label: string;
    init(db: MongoDb): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
    rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<MetricResult<Bucket | undefined>>;
    toBuckets(): AsyncGenerator<Bucket>;
}
export interface BucketIdentifier {
    dimensionKey: string;
    bucketKey: string;
    bucketLabel: string;
}
export declare function hashCodeGivenBucketIdentifier(bucketIdentifier: BucketIdentifier): number;
export interface Bucket {
    readonly identifier: BucketIdentifier;
    hasEntryKey(entryKey: string): Promise<MetricResult<boolean>>;
    toEntryKeys(): Promise<MetricResult<Set<string>>>;
}
