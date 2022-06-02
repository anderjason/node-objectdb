import { Stopwatch } from "@anderjason/time";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MetricResult, MongoDb } from "../..";
import { Metric } from "../../Metric";
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

  get key(): string {
    return this.props.key;
  }

  get label(): string {
    return this.props.label;
  }

  async init(db: MongoDb): Promise<void> {
    this._db = db;

    await this._db.collection("buckets").createIndex({ entryKeys: 1 });
    await this._db
      .collection("buckets")
      .createIndex({ "identifier.bucketKey": 1 });
    await this._db
      .collection("buckets")
      .createIndex({ "identifier.dimensionKey": 1 });
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<MetricResult<MaterializedBucket<T> | undefined>> {
    const metric = new Metric("MaterializedDimension.toOptionalBucketGivenKey");

    const find = {
      "identifier.dimensionKey": this.props.key,
      "identifier.bucketKey": bucketKey,
    };

    const bucketRow = await this._db.collection<any>("buckets").findOne(find);

    if (bucketRow == null) {
      return new MetricResult(metric, undefined);
    }

    const result = new MaterializedBucket({
      identifier: {
        ...bucketRow.identifier,
        bucketLabel: bucketLabel ?? bucketRow.identifier.bucketLabel,
      },
      db: this._db,
    });

    return new MetricResult(metric, result);
  }

  async *toBuckets(): AsyncGenerator<MaterializedBucket<T>> {
    const bucketRows = this._db
      .collection<any>("buckets")
      .find({ "identifier.dimensionKey": this.props.key });

    for await (const row of bucketRows) {
      yield new MaterializedBucket({
        identifier: row.identifier,
        db: this._db,
      });
    }
  }

  async deleteEntryKey(entryKey: string): Promise<MetricResult<void>> {
    const metric = new Metric("MaterializedDimension.deleteEntryKey");

    await this._db.collection("buckets").updateMany(
      {
        "identifier.dimensionKey": this.props.key,
        entryKeys: entryKey,
      },
      {
        $pull: { entryKeys: entryKey },
      }
    );

    return new MetricResult(metric, undefined);
  }

  private async addEntryToBucket(
    entry: Entry<T>,
    bucketIdentifier: BucketIdentifier
  ): Promise<MetricResult<void>> {
    if (bucketIdentifier.dimensionKey !== this.props.key) {
      throw new Error(
        `Received a bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`
      );
    }

    const metric = new Metric("MaterializedDimension.addEntryToBucket");

    const bucketResult: MetricResult<MaterializedBucket<T>> =
      await this.toOptionalBucketGivenKey(
        bucketIdentifier.bucketKey,
        bucketIdentifier.bucketLabel
      );
    metric.addChildMetric(bucketResult.metric);

    let bucket = bucketResult.value;

    if (bucket == null) {
      bucket = new MaterializedBucket({
        identifier: bucketIdentifier,
        db: this._db,
      });
    }

    const addResult = await bucket.addEntryKey(entry.key);
    metric.addChildMetric(addResult.metric);

    return new MetricResult(metric, undefined);
  }

  async rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>> {
    const metric = new Metric("MaterializedDimension.rebuildEntry");

    const deleteResult = await this.deleteEntryKey(entry.key);
    metric.addChildMetric(deleteResult.metric);

    const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);

    if (Array.isArray(bucketIdentifiers)) {
      for (const bucketIdentifier of bucketIdentifiers) {
        if (bucketIdentifier != null) {
          const addResult = await this.addEntryToBucket(
            entry,
            bucketIdentifier
          );
          metric.addChildMetric(addResult.metric);
        }
      }
    } else if (bucketIdentifiers != null) {
      // not an array, just a single object
      const addResult = await this.addEntryToBucket(entry, bucketIdentifiers);
      metric.addChildMetric(addResult.metric);
    }

    return new MetricResult(metric, undefined);
  }
}
