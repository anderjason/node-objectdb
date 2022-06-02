import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { MetricResult, MongoDb } from "../../..";
export interface LiveBucketProps {
    identifier: BucketIdentifier;
    db: MongoDb;
    mongoFilter: any;
}
export declare class LiveBucket<T> extends PropsObject<LiveBucketProps> implements Bucket {
    get identifier(): BucketIdentifier;
    toEntryKeys(): Promise<MetricResult<Set<string>>>;
    hasEntryKey(entryKey: string): Promise<MetricResult<boolean>>;
}
