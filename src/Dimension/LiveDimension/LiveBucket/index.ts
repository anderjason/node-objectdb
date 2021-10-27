import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier } from "../..";
import { MongoDb } from "../../..";

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

  async toEntryKeys(): Promise<Set<string>> {
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
    return new Set(entryKeys);
  }

  async hasEntryKey(entryKey: string): Promise<boolean> {
    const bucket = await this.props.db.collection("entries").findOne({
      key: entryKey,
      ...this.props.mongoFilter,
    });

    return bucket != null;
  }
}
