import { DimensionProps, Dimension } from "..";
import { Entry } from "../..";
import { RelativeBucketIdentifier, Bucket, PortableBucket, isAbsoluteBucketIdentifier } from "../Bucket";
import { MaterializedBucket } from "./MaterializedBucket";

export interface MaterializedDimensionProps<T> extends DimensionProps {
  bucketIdentifiersGivenEntry: (
    entry: Entry<T>
  ) => undefined | RelativeBucketIdentifier | RelativeBucketIdentifier[];
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

    const bucketRows = await this.db
      .collection<PortableBucket>("buckets")
      .find({ "identifier.dimensionKey": this.props.key })
      .toArray();
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

    await this.rebuildEntry(entry);

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

  private rebuildEntryGivenBucketIdentifier(
    entry: Entry<T>,
    bucketIdentifier: RelativeBucketIdentifier
  ): void {
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

  private async rebuildEntry(entry: Entry<T>): Promise<void> {
    const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);

    if (Array.isArray(bucketIdentifiers)) {
      for (const bucketIdentifier of bucketIdentifiers) {
        if (bucketIdentifier != null) {
          this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier);
        }
      }

      const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));

      for (const bucket of this._buckets.values()) {
        if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
          (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
        }
      }
    } else if (bucketIdentifiers != null) {
      // not an array, just a single object
      this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifiers);

      const bucketKey = bucketIdentifiers.bucketKey;
      
      for (const bucket of this._buckets.values()) {
        if (bucket.props.identifier.bucketKey != bucketKey) {
          (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
        }
      }
    } else {
      // undefined, delete all buckets
      for (const bucket of this._buckets.values()) {
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
