import {
  Observable,
  ReadOnlyObservable,
  Receipt,
  TypedEvent,
} from "@anderjason/observable";
import { Debounce, Duration } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Actor } from "skytree";
import { Entry, ObjectDb } from "..";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";

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
  onActivate() {}

  readonly didChange = new TypedEvent();

  abstract hasEntryKey(entryKey: string): Promise<boolean>;
  abstract toPortableObject(): PortableBucket;
  abstract toEntryKeys(): Promise<Set<string>>;

  toBucketIdentifier(): AbsoluteBucketIdentifier {
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
  identifier: RelativeBucketIdentifier;
  storage?: any;
}

export interface PortableDimension {
  type: string;
  buckets: PortableBucket[];
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
  db: DbInstance;

  private _saveLater: Debounce;

  constructor(props: TP) {
    super(props);

    this.key = props.key;

    this._saveLater = new Debounce({
      duration: Duration.givenSeconds(1),
      fn: () => {
        this.save();
      },
    });
  }

  onActivate() {
    this.cancelOnDeactivate(
      new Receipt(() => {
        this._saveLater.clear();
      })
    );
  }

  async load(): Promise<void> {
    const row = this.db
      .prepareCached("SELECT data FROM dimensions WHERE key = ?")
      .get(this.props.key);

    if (row != null) {
      const data = JSON.parse(row.data);
      this.onLoad(data);
    }

    this._isUpdated.setValue(true);
  }

  abstract onLoad(data: PortableDimension): void;
  abstract deleteEntryKey(entryKey: string): Promise<void>;
  abstract entryDidChange(entryKey: string): Promise<void>;

  async save(): Promise<void> {
    const data = JSON.stringify(this.toPortableObject());

    this.db
      .prepareCached(
        `
      INSERT INTO dimensions (key, data) 
      VALUES (?, ?)
      ON CONFLICT(key)
      DO UPDATE SET data=?;`
      )
      .run(this.props.key, data, data);

    this._saveLater.clear();
  }

  toOptionalBucketGivenKey(key: string): Bucket<T> | undefined {
    return this._buckets.get(key);
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
      buckets: Array.from(this._buckets.values()).map((bucket) => {
        return bucket.toPortableObject();
      }),
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
        this.entryDidChange(change.key);
      })
    );
  }

  onLoad(data: PortableDimension) {
    for (const portableBucket of data.buckets) {
      const bucket = new MaterializedBucket({
        identifier: portableBucket.identifier,
        storage: portableBucket.storage,
        dimension: this,
      });

      this.addBucket(bucket);
    }
  }

  async entryDidChange(entryKey: string): Promise<void> {
    this._isUpdated.setValue(false);
    this._waitingForEntryKeys.add(entryKey);

    const entry = await this.objectDb.toOptionalEntryGivenKey(entryKey);
    if (entry == null) {
      await this.deleteEntryKey(entryKey);
    } else {
      await this.rebuildEntry(entry);
    }

    this._waitingForEntryKeys.delete(entryKey);
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
            "Received an absolute bucket identifier for a different dimension"
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
  readonly entryKeys = new ReadOnlySet(this._entryKeys);

  onActivate() {
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
    return this.entryKeys.has(entryKey);
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

  toPortableObject(): PortableBucket {
    return {
      type: "MaterializedBucket",
      identifier: this.props.identifier,
      storage: {
        entryKeys: Array.from(this._entryKeys),
      },
    };
  }
}
