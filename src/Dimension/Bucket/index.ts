import { TypedEvent } from "@anderjason/observable";
import { StringUtil } from "@anderjason/util";
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

export function isAbsoluteBucketIdentifier(
  identifier: RelativeBucketIdentifier
): identifier is AbsoluteBucketIdentifier {
  return "dimensionKey" in identifier;
}

export abstract class Bucket<T> extends Actor<BucketProps<T>> {
  readonly key: string;
  readonly label: string;

  constructor(props: BucketProps<T>) {
    super(props);

    this.key = props.identifier.bucketKey;
    this.label = props.identifier.bucketLabel;
  }

  onActivate() {}

  readonly didChange = new TypedEvent();

  abstract hasEntryKey(entryKey: string): Promise<boolean>;
  abstract toPortableObject(): PortableBucket;
  abstract toEntryKeys(): Promise<Set<string>>;
  abstract save(): Promise<void>;

  toAbsoluteIdentifier(): AbsoluteBucketIdentifier {
    return {
      dimensionKey: this.props.dimension.key,
      ...this.props.identifier,
    };
  }

  toHashCode(): number {
    const key = this.props.dimension.key + this.props.identifier.bucketKey;
    return StringUtil.hashCodeGivenString(key);
  }
}
