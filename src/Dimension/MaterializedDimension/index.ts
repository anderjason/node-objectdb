import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { MaterializedBucket } from "./MaterializedBucket";

export interface MaterializedDimensionProps<T> {
  key: string;
  label: string;
  bucketIdentifiersGivenEntry: (
    entry: Entry<T>
  ) => undefined | BucketIdentifier | BucketIdentifier[];
}

export class MaterializedDimension<T>
  extends PropsObject<MaterializedDimensionProps<T>>
  implements Dimension<T>
{
  private _db: MongoDb;
  private _stopwatch: Stopwatch;

  get key(): string {
    return this.props.key;
  }

  get label(): string {
    return this.props.label;
  }

  async init(db: MongoDb, stopwatch: Stopwatch): Promise<void> {
    this._db = db;
    this._stopwatch = stopwatch;

    await this._db.collection("buckets").createIndex({ entryKeys: 1 });
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<Bucket | undefined> {
    const find = {
      "identifier.dimensionKey": this.props.key,
      "identifier.bucketKey": bucketKey,
    };

    const timer = this._stopwatch.start("md-toOptionalBucketGivenKey");
    const bucketRow = await this._db.collection<any>("buckets").findOne(find);
    timer.stop();

    if (bucketRow == null) {
      return undefined;
    }

    return new MaterializedBucket({
      identifier: {
        ...bucketRow.identifier,
        bucketLabel: bucketLabel ?? bucketRow.identifier.bucketLabel
      },
      db: this._db,
    });
  }

  async toBuckets(): Promise<MaterializedBucket<T>[]> {
    const timer = this._stopwatch.start("md-toBuckets");
    const bucketRows = await this._db
      .collection<any>("buckets")
      .find({ "identifier.dimensionKey": this.props.key })
      .toArray();
    timer.stop();

    const result: MaterializedBucket<T>[] = [];

    const timer2 = this._stopwatch.start("md-toBuckets-loop");
    for (const row of bucketRows) {
      result.push(
        new MaterializedBucket({
          identifier: row.identifier,
          db: this._db,
        })
      );
    }
    timer2.stop();

    return result;
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    const timer = this._stopwatch.start("md-deleteEntryKey");
    await this._db.collection("buckets").updateMany(
      {
        "identifier.dimensionKey": this.props.key,
        entryKeys: entryKey,
      },
      {
        $pull: { entryKeys: entryKey },
      }
    );
    timer.stop();
  }

  private async addEntryToBucket(
    entry: Entry<T>,
    bucketIdentifier: BucketIdentifier
  ): Promise<void> {
    if (bucketIdentifier.dimensionKey !== this.props.key) {
      throw new Error(
        `Received a bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`
      );
    }

    const timer = this._stopwatch.start("md-addEntryToBucket");

    let bucket = (await this.toOptionalBucketGivenKey(
      bucketIdentifier.bucketKey,
      bucketIdentifier.bucketLabel
    )) as MaterializedBucket<T>;

    if (bucket == null) {
      bucket = new MaterializedBucket({
        identifier: bucketIdentifier,
        db: this._db,
      });
    }

    await bucket.addEntryKey(entry.key);
    timer.stop();
  }

  async rebuildEntry(entry: Entry<T>): Promise<void> {
    const timer = this._stopwatch.start("md-rebuildEntry");
    await this.deleteEntryKey(entry.key);

    const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);

    if (Array.isArray(bucketIdentifiers)) {
      for (const bucketIdentifier of bucketIdentifiers) {
        if (bucketIdentifier != null) {
          await this.addEntryToBucket(entry, bucketIdentifier);
        }
      }
    } else if (bucketIdentifiers != null) {
      // not an array, just a single object
      await this.addEntryToBucket(entry, bucketIdentifiers);
    }
    timer.stop();
  }
}
