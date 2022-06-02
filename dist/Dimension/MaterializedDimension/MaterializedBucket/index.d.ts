import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { MetricResult, MongoDb } from "../../..";
export interface MaterializedBucketProps {
    identifier: BucketIdentifier;
    db: MongoDb;
}
export declare class MaterializedBucket<T> extends PropsObject<MaterializedBucketProps> implements Bucket {
    get identifier(): BucketIdentifier;
    toEntryKeys(): Promise<MetricResult<Set<string>>>;
    hasEntryKey(entryKey: string): Promise<MetricResult<boolean>>;
    addEntryKey(entryKey: string): Promise<MetricResult<void>>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
}
