import { PropsObject } from "skytree";
import { Entry, MetricResult, MongoDb } from "../../..";
import { Bucket, BucketIdentifier, Dimension } from "../../../Dimension";
import { SelectProperty } from "../SelectProperty";
export interface SelectDimensionProps {
    property: SelectProperty;
}
export declare class SelectDimension<T> extends PropsObject<SelectDimensionProps> implements Dimension<T> {
    private _db;
    get key(): string;
    get label(): string;
    init(db: MongoDb): Promise<void>;
    toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<MetricResult<Bucket | undefined>>;
    deleteBucketKey(bucketKey: string): Promise<MetricResult<void>>;
    toBucketIdentifiers(): AsyncGenerator<BucketIdentifier>;
    toBuckets(): AsyncGenerator<Bucket>;
    deleteEntryKey(entryKey: string): Promise<MetricResult<void>>;
    rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>>;
}
