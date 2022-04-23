import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { MongoDb } from "../../..";
export interface MaterializedBucketProps {
    identifier: BucketIdentifier;
    db: MongoDb;
}
export declare class MaterializedBucket<T> extends PropsObject<MaterializedBucketProps> implements Bucket {
    get identifier(): BucketIdentifier;
    toEntryKeys(): Promise<Set<string>>;
    hasEntryKey(entryKey: string): Promise<boolean>;
    addEntryKey(entryKey: string): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
