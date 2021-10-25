import { Bucket, BucketIdentifier } from "../..";
import { MongoDb } from "../../..";
import { PropsObject } from "../../../PropsObject";

export interface MaterializedBucketProps<T> {
  identifier: BucketIdentifier;
  db: MongoDb;
}

export class MaterializedBucket<T>
  extends PropsObject<MaterializedBucketProps<T>>
  implements Bucket
{
  get identifier(): BucketIdentifier {
    return this.props.identifier;
  }

  async toEntryKeys(): Promise<Set<string>> {
    const bucket = await this.props.db
      .collection("buckets")
      .findOne<any>({ key: this.props.identifier.bucketKey });

    if (bucket == null) {
      return new Set();
    }

    const entryKeys = bucket.entryKeys ?? bucket.storage?.entryKeys;
    return new Set(entryKeys);
  }

  async hasEntryKey(entryKey: string): Promise<boolean> {
    const bucket = await this.props.db.collection("buckets").findOne<any>({
      key: this.props.identifier.bucketKey,
      entryKeys: entryKey,
    });

    return bucket != null;
  }

  async addEntryKey(entryKey: string): Promise<void> {
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

    const bucketRow = await this.props.db
      .collection<any>("buckets")
      .findOne({ key: this.props.identifier.bucketKey });
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    await this.props.db.collection("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $pull: { entryKeys: entryKey },
      }
    );
  }
}
