import { DimensionProps, Dimension } from "..";
import { Entry } from "../..";
import { RelativeBucketIdentifier, Bucket } from "../Bucket";
export interface MaterializedDimensionProps<T> extends DimensionProps {
    bucketIdentifiersGivenEntry: (entry: Entry<T>) => undefined | RelativeBucketIdentifier | RelativeBucketIdentifier[];
}
export declare class MaterializedDimension<T> extends Dimension<T, MaterializedDimensionProps<T>> {
    protected _bucketsByEntryKey: Map<string, Bucket<T>[]>;
    private _waitingForEntryKeys;
    onActivate(): void;
    load(): Promise<void>;
    entryDidChange(entry: Entry<T>): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private rebuildEntryGivenBucketIdentifier;
    private rebuildEntry;
    rebuild(): Promise<void>;
}
