import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { PropsObject } from "../../PropsObject";
import { MaterializedBucket } from "./MaterializedBucket";
export interface MaterializedDimensionProps<T> {
    key: string;
    label: string;
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => undefined | BucketIdentifier | BucketIdentifier[];
}
export declare class MaterializedDimension<T> extends PropsObject<MaterializedDimensionProps<T>> implements Dimension<T> {
    protected _bucketsByEntryKey: Map<string, Bucket[]>;
    get key(): string;
    get label(): string;
    db: MongoDb;
    toOptionalBucketGivenKey(bucketKey: string): Promise<Bucket | undefined>;
    toBuckets(): Promise<MaterializedBucket<T>[]>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private addEntryToBucket;
    rebuildEntry(entry: Entry<T>): Promise<void>;
}
