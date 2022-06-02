import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../Dimension";
import { Entry, MetricResult, MongoDb } from "../..";
import { SelectProperty } from "../Select/SelectProperty";
export interface IsSetDimensionProps {
    property: SelectProperty;
}
export declare class IsSetDimension<T> extends PropsObject<IsSetDimensionProps> implements Dimension<T> {
    private _db;
    get key(): string;
    get label(): string;
    init(db: MongoDb): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<MetricResult<Bucket | undefined>>;
    deleteBucketKey(bucketKey: string): Promise<MetricResult<void>>;
    toBucketIdentifiers(): Promise<BucketIdentifier[]>;
    toBuckets(): AsyncGenerator<Bucket>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
    rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>>;
}
