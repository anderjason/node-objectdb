import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { MetricResult, MongoDb } from "../../..";
import { Metric } from "../../../Metric";

export interface LiveBucketProps {
  identifier: BucketIdentifier;
  db: MongoDb;
  mongoFilter: any;
}

export class LiveBucket<T>
  extends PropsObject<LiveBucketProps>
  implements Bucket
{
  get identifier(): BucketIdentifier {
    return this.props.identifier;
  }

  async toEntryKeys(): Promise<MetricResult<Set<string>>> {
    const metric = new Metric("LiveBucket.toEntryKeys");

    const rows = await this.props.db
      .collection("entries")
      .find<any>(this.props.mongoFilter, {
        projection: {
          _id: 0,
          key: 1,
        },
      })
      .collation({ locale: "en", strength: 2 })
      .toArray();

    const entryKeys = rows.map((row) => row.key);
    const result = new Set(entryKeys);

    return new MetricResult(metric, result);
  }

  async hasEntryKey(entryKey: string): Promise<MetricResult<boolean>> {
    const metric = new Metric("LiveBucket.hasEntryKey");

    const bucket = await this.props.db.collection("entries").findOne({
      key: entryKey,
      ...this.props.mongoFilter,
    });

    const result = bucket != null;

    return new MetricResult(metric, result);
  }
}
