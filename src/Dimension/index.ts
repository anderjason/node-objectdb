import {
  Observable,
  ReadOnlyObservable
} from "@anderjason/observable";
import { Actor } from "skytree";
import { Entry, MongoDb, ObjectDb } from "..";
import { Bucket } from "./Bucket";

export interface PortableDimension {
  type: string;
}

export interface DimensionProps {
  key: string;
  label: string;
}

export abstract class Dimension<
  T,
  TP extends DimensionProps
> extends Actor<TP> {
  protected _buckets = new Map<string, Bucket<T>>();

  readonly key: string;

  protected _isUpdated = Observable.givenValue(true, Observable.isStrictEqual);
  readonly isUpdated = ReadOnlyObservable.givenObservable(this._isUpdated);

  label: string;
  objectDb: ObjectDb<T>;
  db: MongoDb;

  constructor(props: TP) {
    super(props);

    this.key = props.key;
    this.label = props.label;
  }

  onActivate() {
    this._isUpdated.setValue(true);
  }

  abstract load(): Promise<void>;
  abstract deleteEntryKey(entryKey: string): Promise<void>;
  abstract rebuildEntry(entry: Entry<T>): Promise<void>;

  async ensureUpdated(): Promise<void> {
    if (this._isUpdated.value == true) {
      return;
    }

    console.log(`Waiting for dimension ${this.props.label} to be updated`);
    await this._isUpdated.toPromise(v => v);
    console.log(`Dimension ${this.props.label} is updated`);
  }

  toOptionalBucketGivenKey(key: string): Bucket<T> | undefined {
    return this._buckets.get(key);
  }

  toBuckets(): IterableIterator<Bucket<T>> {
    return this._buckets.values();
  }

  addBucket(bucket: Bucket<T>): void {
    this.addActor(bucket);

    this._buckets.set(bucket.props.identifier.bucketKey, bucket);
  }

  toPortableObject(): PortableDimension {
    return {
      type: this.constructor.name,
    };
  }
}
