import {
  Observable,
  ReadOnlyObservable,
  Receipt,
  TypedEvent,
} from "@anderjason/observable";
import { Debounce, Duration } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Actor } from "skytree";
import { Entry, MongoDb, ObjectDb } from "..";

export interface BucketProps<T> {
  identifier: RelativeBucketIdentifier;
  dimension: Dimension<T, DimensionProps>;

  storage?: any;
}

function isAbsoluteBucketIdentifier(
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

export interface MaterializedDimensionProps<T> extends DimensionProps {
  bucketIdentifiersGivenEntry: (entry: Entry<T>) => RelativeBucketIdentifier[];
}

export class MaterializedDimension<T> extends Dimension<
  T,
  MaterializedDimensionProps<T>
> {
  protected _bucketsByEntryKey = new Map<string, Bucket<T>[]>();

  private _waitingForEntryKeys = new Set<string>();

  onActivate() {
    super.onActivate();

    this.cancelOnDeactivate(
      this.objectDb.entryDidChange.subscribe(async (change) => {        
        if (change.newData != null) {
          this.entryDidChange(change.entry);
        } else {
          this.deleteEntryKey(change.key);
        }
      })
    );
  }

  async load(): Promise<void> {
    // const row = await this.db.collection<any>("dimensions").findOne({ key: this.props.key });

    const bucketRows = await this.db.collection<PortableBucket>("buckets").find({ "identifier.dimensionKey": this.props.key }).toArray();
    for (const bucketRow of bucketRows) {
      const bucket = new MaterializedBucket({
        identifier: bucketRow.identifier,
        storage: bucketRow.storage,
        dimension: this,
      });

      this.addBucket(bucket);
    }

    this._isUpdated.setValue(true);
  }

  async entryDidChange(entry: Entry<T>): Promise<void> {
    this._isUpdated.setValue(false);
    this._waitingForEntryKeys.add(entry.key);

    if (entry == null) {
      await this.deleteEntryKey(entry.key);
    } else {
      await this.rebuildEntry(entry);
    }

    this._waitingForEntryKeys.delete(entry.key);
    if (this._waitingForEntryKeys.size === 0) {
      this._isUpdated.setValue(true);
    }
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    for (const bucket of this._buckets.values()) {
      (bucket as MaterializedBucket<T>).deleteEntryKey(entryKey);
    }
  }

  private async rebuildEntry(entry: Entry<T>): Promise<void> {
    let bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry) ?? [];
    bucketIdentifiers = bucketIdentifiers.filter((bi) => bi != null);

    for (const bucketIdentifier of bucketIdentifiers) {
      if (isAbsoluteBucketIdentifier(bucketIdentifier)) {
        if (bucketIdentifier.dimensionKey !== this.props.key) {
          throw new Error(
            `Received an absolute bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`
          );
        }
      }

      // create the bucket if necessary
      if (!this._buckets.has(bucketIdentifier.bucketKey)) {
        const bucket = new MaterializedBucket({
          identifier: bucketIdentifier,
          dimension: this,
        });

        this.addBucket(bucket);
      }

      const bucket = this._buckets.get(
        bucketIdentifier.bucketKey
      ) as MaterializedBucket<T>;

      bucket.addEntryKey(entry.key);
    }

    const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));

    for (const bucket of this._buckets.values()) {
      if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
        (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
      }
    }
  }

  async rebuild(): Promise<void> {
    await this.objectDb.forEach(async (entry) => {
      await this.rebuildEntry(entry);
    });

    this.save();
  }
}

interface PortableMaterializedBucketStorage {
  entryKeys: string[];
}

export class MaterializedBucket<T> extends Bucket<T> {
  private _entryKeys = new Set<string>();

  onActivate() {
    this._entryKeys.clear();

    const storage = this.props.storage as PortableMaterializedBucketStorage;
    if (storage != null && storage.entryKeys != null) {
      this._entryKeys.clear();
      for (const entryKey of storage.entryKeys) {
        this._entryKeys.add(entryKey);
      }
    }
  }

  async toEntryKeys(): Promise<Set<string>> {
    return new Set(this._entryKeys);
  }

  async hasEntryKey(entryKey: string): Promise<boolean> {
    return this._entryKeys.has(entryKey);
  }

  addEntryKey(entryKey: string): void {
    if (this._entryKeys.has(entryKey)) {
      return;
    }

    this._entryKeys.add(entryKey);
    this.didChange.emit();
  }

  deleteEntryKey(entryKey: string): void {
    if (!this._entryKeys.has(entryKey)) {
      return;
    }

    this._entryKeys.delete(entryKey);
    this.didChange.emit();
  }

  async save(): Promise<void> {
    const data = this.toPortableObject();
    
    if (this.props.dimension.db.isConnected.value == false) {
      console.error("Cannot save bucket because MongoDb is not connected");
      return;
    }

    await this.props.dimension.db.collection<any>("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $set: {
          ...data
        },
      },
      { upsert: true }
    );
  }

  toPortableObject(): PortableBucket {
    return {
      type: "MaterializedBucket",
      identifier: this.toAbsoluteIdentifier(),
      storage: {
        entryKeys: Array.from(this._entryKeys),
      },
    };
  }
}
