import { PropsObject } from "skytree";
import { BucketIdentifier, Dimension } from "..";
import { Entry, MetricResult, MongoDb } from "../..";
import { MaterializedBucket } from "./MaterializedBucket";
export interface MaterializedDimensionProps<T> {
    key: string;
    label: string;
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => undefined | BucketIdentifier | BucketIdentifier[];
}
export declare class MaterializedDimension<T> extends PropsObject<MaterializedDimensionProps<T>> implements Dimension<T> {
    private _db;
    get key(): string;
    get label(): string;
    init(db: MongoDb): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<MetricResult<MaterializedBucket<T> | undefined>>;
    toBuckets(): AsyncGenerator<MaterializedBucket<T>>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
    private addEntryToBucket;
    rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>>;
}
