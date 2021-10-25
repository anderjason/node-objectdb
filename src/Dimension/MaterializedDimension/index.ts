import { Observable } from "@anderjason/observable";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { PropsObject } from "../../PropsObject";
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
  protected _bucketsByEntryKey = new Map<string, Bucket[]>();

  get key(): string {
    return this.props.key;
  }

  get label(): string {
    return this.props.label;
  }

  db: MongoDb;

  async toOptionalBucketGivenKey(
    bucketKey: string
  ): Promise<Bucket | undefined> {
    const find = {
      "identifier.dimensionKey": this.props.key,
      "identifier.bucketKey": bucketKey,
    };

    const bucketRow = await this.db.collection<any>("buckets").findOne(find);

    if (bucketRow == null) {
      return undefined;
    }

    return new MaterializedBucket({
      identifier: bucketRow.identifier,
      db: this.db,
    });
  }

  async toBuckets(): Promise<MaterializedBucket<T>[]> {
    const bucketRows = await this.db
      .collection<any>("buckets")
      .find({ "identifier.dimensionKey": this.props.key })
      .toArray();

    const result: MaterializedBucket<T>[] = [];

    for (const row of bucketRows) {
      result.push(
        new MaterializedBucket({
          identifier: row.identifier,
          db: this.db,
        })
      );
    }

    return result;
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    await this.db.collection("buckets").updateMany(
      { "identifier.dimensionKey": this.props.key, entryKeys: entryKey },
      {
        $pull: { entryKeys: entryKey },
      }
    );
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

    let bucket = (await this.toOptionalBucketGivenKey(
      bucketIdentifier.bucketKey
    )) as MaterializedBucket<T>;
    if (bucket == null) {
      bucket = new MaterializedBucket({
        identifier: bucketIdentifier,
        db: this.db,
      });
    }

    await bucket.addEntryKey(entry.key);
  }

  async rebuildEntry(entry: Entry<T>): Promise<void> {
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
  }
}
