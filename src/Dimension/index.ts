import { Stopwatch } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Entry, MongoDb } from "..";

export interface Dimension<T> {
  readonly key: string;
  readonly label: string;
  
  db: MongoDb;
  stopwatch: Stopwatch;
  
  deleteEntryKey(entryKey: string): Promise<void>;
  rebuildEntry(entry: Entry<T>): Promise<void>;
  
  toOptionalBucketGivenKey(key: string): Promise<Bucket | undefined>;
  toBuckets(): Promise<Bucket[]>;
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
