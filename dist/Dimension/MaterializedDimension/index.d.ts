import { DimensionProps, Dimension } from "..";
import { Entry } from "../..";
import { RelativeBucketIdentifier, Bucket } from "../Bucket";
export interface MaterializedDimensionProps<T> extends DimensionProps {
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => undefined | RelativeBucketIdentifier | RelativeBucketIdentifier[];
}
export declare class MaterializedDimension<T> extends Dimension<T, MaterializedDimensionProps<T>> {
    protected _bucketsByEntryKey: Map<string, Bucket<T>[]>;
    private _entryQueue;
    private _processing;
    onActivate(): void;
    load(): Promise<void>;
    processEntryQueue(): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private rebuildEntryGivenBucketIdentifier;
    rebuildEntry(entry: Entry<T>): Promise<void>;
    rebuild(): Promise<void>;
}
