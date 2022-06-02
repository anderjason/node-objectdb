import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { Metric, MetricResult, MongoDb } from "../../..";

export interface MaterializedBucketProps {
  identifier: BucketIdentifier;
  db: MongoDb;
}

export class MaterializedBucket<T>
  extends PropsObject<MaterializedBucketProps>
  implements Bucket
{
  get identifier(): BucketIdentifier {
    return this.props.identifier;
  }

  async toEntryKeys(): Promise<MetricResult<Set<string>>> {
    const metric = new Metric("MaterializedBucket.toEntryKeys");

    const bucket = await this.props.db
      .collection("buckets")
      .findOne<any>({ key: this.props.identifier.bucketKey });

    if (bucket == null) {
      return new MetricResult(metric, new Set());
    }

    const entryKeys = bucket.entryKeys ?? bucket.storage?.entryKeys;
    return new MetricResult(metric, new Set(entryKeys));
  }

  async hasEntryKey(entryKey: string): Promise<MetricResult<boolean>> {
    const metric = new Metric("MaterializedBucket.hasEntryKey");

    const bucket = await this.props.db.collection("buckets").findOne<any>({
      key: this.props.identifier.bucketKey,
      entryKeys: entryKey,
    });

    const result = bucket != null;

    return new MetricResult(metric, result);
  }

  async addEntryKey(entryKey: string): Promise<MetricResult<void>> {
    const metric = new Metric("MaterializedBucket.addEntryKey");

    await this.props.db.collection("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $set: {
          identifier: this.props.identifier,
        },
        $push: { entryKeys: entryKey },
      },
      { upsert: true }
    );

    // await this.props.db
    //   .collection<any>("buckets")
    //   .findOne({ key: this.props.identifier.bucketKey });

    return new MetricResult(metric, undefined);
  }

  async deleteEntryKey(entryKey: string): Promise<MetricResult<void>> {
    const metric = new Metric("MaterializedBucket.deleteEntryKey");

    await this.props.db.collection("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $pull: { entryKeys: entryKey },
      }
    );

    return new MetricResult(metric, undefined);
  }
}
