import {
  Observable,
  ReadOnlyObservable,
  Receipt
} from "@anderjason/observable";
import { Debounce, Duration } from "@anderjason/time";
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

  protected _isUpdated = Observable.givenValue(false, Observable.isStrictEqual);
  readonly isUpdated = ReadOnlyObservable.givenObservable(this._isUpdated);

  label: string;
  objectDb: ObjectDb<T>;
  db: MongoDb;

  private _saveLater: Debounce;

  constructor(props: TP) {
    super(props);

    this.key = props.key;
    this.label = props.label;

    this._saveLater = new Debounce({
      duration: Duration.givenSeconds(15),
      fn: async () => {
        try {
          await this.save();
        } catch (err) {
          console.error(`An error occurred in Dimension.saveLater: ${err}`);
        }
      },
    });
  }

  onActivate() {
    this._isUpdated.setValue(false);

    this.cancelOnDeactivate(
      new Receipt(() => {
        this._saveLater.clear();
      })
    );
  }

  abstract load(): Promise<void>;
  abstract deleteEntryKey(entryKey: string): Promise<void>;
  abstract entryDidChange(entry: Entry<T>): Promise<void>;

  async save(): Promise<void> {
    const data = this.toPortableObject();

    if (this.db.isConnected.value == false) {
      console.error("Cannot save dimension because MongoDb is not connected");
      return;
    }

    await this.db.collection<any>("dimensions").updateOne(
      { key: this.props.key },
      {
        $set: {
          ...data,
        },
      },
      { upsert: true }
    );

    for (const bucket of this._buckets.values()) {
      await bucket.save();
    }

    this._saveLater.clear();
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

    this.cancelOnDeactivate(
      bucket.didChange.subscribe(() => {
        this._saveLater.invoke();
      })
    );
  }

  toPortableObject(): PortableDimension {
    return {
      type: this.constructor.name,
    };
  }
}


