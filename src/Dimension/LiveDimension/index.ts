import { Stopwatch } from "@anderjason/time";
import { ArrayUtil } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { LiveBucket } from "./LiveBucket";

export interface LiveDimensionProps<T> {
  key: string;
  label: string;
  mongoFilterGivenBucketIdentifier: (identifier: BucketIdentifier) => any;
  allBucketIdentifiers: (db: MongoDb) => Promise<BucketIdentifier[]>;
}

export interface LiveDimensionOfEntryParams {
  dimensionLabel: string;
  propertyName: string;
  propertyType: "value" | "array";

  dimensionKey?: string;
  labelGivenKey?: (key: string) => string;
  mongoValueGivenBucketKey?: (bucketKey: string) => any;
}

export class LiveDimension<T>
  extends PropsObject<LiveDimensionProps<T>>
  implements Dimension<T>
{
  static ofEntry<T>(params: LiveDimensionOfEntryParams): LiveDimension<T> {
    const fullPropertyName = `data.${params.propertyName}`;

    return new LiveDimension<T>({
      key: params.dimensionKey ?? params.propertyName,
      label: params.dimensionLabel,
      allBucketIdentifiers: async (db: MongoDb) => {
        if (params.propertyType === "value") {
          const messages = await db
            .collection("entries")
            .find<any>(
              {
                [fullPropertyName]: { $exists: true },
              },
              { projection: { _id: 0, [fullPropertyName]: 1 } }
            )
            .toArray();

          return messages.map((m) => {
            const key = m.data[params.propertyName];
            const label =
              params.labelGivenKey != null ? params.labelGivenKey(key) : key;

            return {
              dimensionKey: params.dimensionKey ?? params.propertyName,
              bucketKey: key,
              bucketLabel: label,
            };
          });
        } else if (params.propertyType === "array") {
          const aggregateResult = await db
            .collection("entries")
            .aggregate<any>([
              {
                $match: {
                  [fullPropertyName]: { $exists: true },
                },
              },
              { $project: { a: `$data.${params.propertyName}` } },
              { $unwind: "$a" },
              { $group: { _id: "a", res: { $addToSet: "$a" } } },
            ])
            .toArray();

          const row = aggregateResult[0];
          const allValues = row == null ? [] : row.res;
          allValues.sort();

          return allValues.map((value: any) => {
            const key = String(value);
            const label =
              params.labelGivenKey != null ? params.labelGivenKey(key) : key;

            return {
              dimensionKey: params.dimensionKey ?? params.propertyName,
              bucketKey: key,
              bucketLabel: label,
            };
          });
        }
      },
      mongoFilterGivenBucketIdentifier: (
        bucketIdentifier: BucketIdentifier
      ) => {
        const key = bucketIdentifier.bucketKey
        const value = params.mongoValueGivenBucketKey != null ? params.mongoValueGivenBucketKey(key) : key;

        return {
          [fullPropertyName]: value,
        };
      },
    });
  }

  get key(): string {
    return this.props.key;
  }

  get label(): string {
    return this.props.label;
  }

  db: MongoDb;
  stopwatch: Stopwatch;

  async toOptionalBucketGivenKey(
    bucketKey: string
  ): Promise<Bucket | undefined> {
    const bucketIdentifiers = await this.toBucketIdentifiers();

    const identifier = bucketIdentifiers.find(
      (bi) => bi.bucketKey === bucketKey
    );
    if (identifier == null) {
      return undefined;
    }

    return new LiveBucket({
      identifier: identifier,
      db: this.db,
      mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
    });
  }

  async toBucketIdentifiers(): Promise<BucketIdentifier[]> {
    const timer = this.stopwatch.start("allBucketIdentifiers");
    const bucketIdentifiers = await this.props.allBucketIdentifiers(this.db);
    timer.stop();
    return bucketIdentifiers;
  }

  async toBuckets(): Promise<LiveBucket<T>[]> {
    const bucketIdentifiers = await this.toBucketIdentifiers();

    const result: LiveBucket<T>[] = [];

    const timer2 = this.stopwatch.start("toBuckets - loop");
    for (const identifier of bucketIdentifiers) {
      result.push(
        new LiveBucket({
          identifier,
          db: this.db,
          mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
        })
      );
    }
    timer2.stop();

    return result;
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    // empty
  }

  async rebuildEntry(entry: Entry<T>): Promise<void> {
    // empty
  }
}