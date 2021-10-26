import { Stopwatch } from "@anderjason/time";
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
          const entries = await db
            .collection("entries")
            .find<any>(
              {
                [fullPropertyName]: { $exists: true },
              },
              { projection: { _id: 0, [fullPropertyName]: 1 } }
            )
            .toArray();

          const values = entries.map((e) => e.data[params.propertyName]);
          const uniqueValues = Array.from(new Set(values));
          uniqueValues.sort();

          return uniqueValues.map((value) => {
            const key = String(value);
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
          const allValues = row == null ? [] : Array.from(new Set(row.res));
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
  }

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
      db: this._db,
      mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
    });
  }

  async toBucketIdentifiers(): Promise<BucketIdentifier[]> {
    const timer = this._stopwatch.start("ld-allBucketIdentifiers");
    const bucketIdentifiers = await this.props.allBucketIdentifiers(this._db);
    timer.stop();
    return bucketIdentifiers;
  }

  async toBuckets(): Promise<LiveBucket<T>[]> {
    const bucketIdentifiers = await this.toBucketIdentifiers();

    const result: LiveBucket<T>[] = [];

    const timer2 = this._stopwatch.start("ld-toBuckets-loop");
    for (const identifier of bucketIdentifiers) {
      result.push(
        new LiveBucket({
          identifier,
          db: this._db,
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
