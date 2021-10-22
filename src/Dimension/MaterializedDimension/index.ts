import { DimensionProps, Dimension } from "..";
import { Entry } from "../..";
import { EntryChange } from "../../ObjectDb";
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

  private _entryQueue: EntryChange<T>[] = [];
  private _processing: boolean = false;

  onActivate() {
    super.onActivate();

    this.cancelOnDeactivate(
      this.objectDb.entryDidChange.subscribe(async (change) => {
        this._entryQueue.push(change);
        this.processEntryQueue();          
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

  async processEntryQueue(): Promise<void> {
    if (this._processing) {
      return;
    }

    if (this._entryQueue.length === 0) {
      this._isUpdated.setValue(true);
      return;
    }

    this._isUpdated.setValue(false);
    this._processing = true;

    while (this._entryQueue.length > 0) {
      const change = this._entryQueue.shift()!;

      if (change.newData != null) {
        await this.rebuildEntry(change.entry);
      } else {
        await this.deleteEntryKey(change.entry.key);
      }
    }

    this._processing = false;
    this._isUpdated.setValue(true);
  }
  
  async deleteEntryKey(entryKey: string): Promise<void> {
    for (const bucket of this._buckets.values()) {
      (bucket as MaterializedBucket<T>).deleteEntryKey(entryKey);
    }
  }

  override async save(): Promise<void> {
    await super.save();

    await this.isUpdated.toPromise(v => v);
  }

  private async rebuildEntryGivenBucketIdentifier(
    entry: Entry<T>,
    bucketIdentifier: RelativeBucketIdentifier
  ): Promise<void> {
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

    await bucket.addEntryKey(entry.key);
  }

  async rebuildEntry(entry: Entry<T>): Promise<void> {
    const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);

    if (Array.isArray(bucketIdentifiers)) {
      for (const bucketIdentifier of bucketIdentifiers) {
        if (bucketIdentifier != null) {
          await this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier);
        }
      }

      const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));

      for (const bucket of this._buckets.values()) {
        if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
          await (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
        }
      }
    } else if (bucketIdentifiers != null) {
      // not an array, just a single object
      this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifiers);

      const bucketKey = bucketIdentifiers.bucketKey;
      
      for (const bucket of this._buckets.values()) {
        if (bucket.props.identifier.bucketKey != bucketKey) {
          await (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
        }
      }
    } else {
      // undefined, delete all buckets
      for (const bucket of this._buckets.values()) {
        await (bucket as MaterializedBucket<T>).deleteEntryKey(entry.key);
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
