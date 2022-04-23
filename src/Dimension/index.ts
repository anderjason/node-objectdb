import { Stopwatch } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Entry, MongoDb } from "..";

export interface Dimension<T> {
  readonly key: string;
  readonly label: string;
  
  init(db: MongoDb, stopwatch: Stopwatch): Promise<void>;
  
  deleteEntryKey(entryKey: string): Promise<void>;
  rebuildEntry(entry: Entry<T>): Promise<void>;
  
  toOptionalBucketGivenKey(bucketKey: string, bucketLabel?: string): Promise<Bucket | undefined>;
  toBuckets(): AsyncGenerator<Bucket>;
}

export interface BucketIdentifier {
  dimensionKey: string;
  bucketKey: string;
  bucketLabel: string;
}

export function hashCodeGivenBucketIdentifier(bucketIdentifier: BucketIdentifier): number {
  const key = bucketIdentifier.dimensionKey + bucketIdentifier.bucketKey;
  return StringUtil.hashCodeGivenString(key);
}

export interface Bucket {
  readonly identifier: BucketIdentifier;
  
  hasEntryKey(entryKey: string): Promise<boolean>;
  toEntryKeys(): Promise<Set<string>>;
}
