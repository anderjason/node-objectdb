import { TypedEvent } from "@anderjason/observable";
import { Actor } from "skytree";
import { Dimension, DimensionProps } from "..";
export interface RelativeBucketIdentifier {
    bucketKey: string;
    bucketLabel: string;
}
export interface AbsoluteBucketIdentifier extends RelativeBucketIdentifier {
    dimensionKey: string;
}
export interface PortableBucket {
    type: string;
    identifier: AbsoluteBucketIdentifier;
    storage?: any;
}
export interface BucketProps<T> {
    identifier: RelativeBucketIdentifier;
    dimension: Dimension<T, DimensionProps>;
    storage?: any;
}
export declare function isAbsoluteBucketIdentifier(identifier: RelativeBucketIdentifier): identifier is AbsoluteBucketIdentifier;
export declare abstract class Bucket<T> extends Actor<BucketProps<T>> {
    readonly key: string;
    readonly label: string;
    constructor(props: BucketProps<T>);
    onActivate(): void;
    readonly didChange: TypedEvent<void>;
    abstract hasEntryKey(entryKey: string): Promise<boolean>;
    abstract toEntryKeys(): Promise<Set<string>>;
    toAbsoluteIdentifier(): AbsoluteBucketIdentifier;
    toHashCode(): number;
}
