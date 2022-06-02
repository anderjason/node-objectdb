import { Stopwatch } from "@anderjason/time";
import { ObjectUtil, ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MetricResult, MongoDb } from "../..";
import { Metric } from "../../Metric";
import { LiveBucket } from "./LiveBucket";

export interface LiveDimensionProps<T> {
  key: string;
  label: string;
  mongoFilterGivenBucketIdentifier: (identifier: BucketIdentifier) => any;
  allBucketIdentifiers: (db: MongoDb) => Promise<BucketIdentifier[]>;
}

export interface LiveDimensionOfEntryParams {
  dimensionKey: string;
  dimensionLabel: string;
  valuePath: ValuePath<any>;
  valueType: "single" | "array";

  labelGivenKey?: (key: string) => string;
  mongoValueGivenBucketKey?: (bucketKey: string) => any;
}

export class LiveDimension<T>
  extends PropsObject<LiveDimensionProps<T>>
  implements Dimension<T>
{
  static ofEntry<T>(params: LiveDimensionOfEntryParams): LiveDimension<T> {
    const fullPropertyName = params.valuePath.toParts().join(".");

    return new LiveDimension<T>({
      key: params.dimensionKey,
      label: params.dimensionLabel,
      allBucketIdentifiers: async (db: MongoDb) => {
        if (params.valueType === "single") {
          const entries = await db
            .collection("entries")
            .find<any>(
              {
                [fullPropertyName]: { $exists: true },
              },
              { projection: { _id: 0, [fullPropertyName]: 1 } }
            )
            .toArray();

          const values = entries.map((e) => {
            return ObjectUtil.optionalValueAtPathGivenObject(
              e,
              params.valuePath
            );
          });

          const uniqueValues = Array.from(new Set(values));
          uniqueValues.sort();

          return uniqueValues.map((value) => {
            const key = String(value);
            const label =
              params.labelGivenKey != null ? params.labelGivenKey(key) : key;

            return {
              dimensionKey: params.dimensionKey,
              bucketKey: key,
              bucketLabel: label,
            };
          });
        } else if (params.valueType === "array") {
          const aggregateResult = await db
            .collection("entries")
            .aggregate<any>([
              {
                $match: {
                  [fullPropertyName]: { $exists: true },
                },
              },
              { $project: { a: "$" + fullPropertyName } },
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
              dimensionKey: params.dimensionKey,
              bucketKey: key,
              bucketLabel: label,
            };
          });
        } else {
          throw new Error("Unsupported value type");
        }
      },
      mongoFilterGivenBucketIdentifier: (
        bucketIdentifier: BucketIdentifier
      ) => {
        const key = bucketIdentifier.bucketKey;
        const value =
          params.mongoValueGivenBucketKey != null
            ? params.mongoValueGivenBucketKey(key)
            : key;

        return {
          [fullPropertyName]: value,
        };
      },
    });
  }

  private _db: MongoDb;

  get key(): string {
    return this.props.key;
  }

  get label(): string {
    return this.props.label;
  }

  async init(db: MongoDb): Promise<void> {
    this._db = db;
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<MetricResult<Bucket | undefined>> {
    const metric = new Metric("LiveDimension.toOptionalBucketGivenKey");

    const identifier = {
      dimensionKey: this.key,
      bucketKey,
      bucketLabel: bucketLabel ?? bucketKey,
    };

    const result = new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
    });

    return new MetricResult(metric, result);
  }

  async *toBucketIdentifiers(): AsyncGenerator<BucketIdentifier> {
    // TODO optimize
    const bucketIdentifiers = await this.props.allBucketIdentifiers(this._db);
    for (const identifier of bucketIdentifiers) {
      yield identifier;
    }
  }

  async *toBuckets(): AsyncGenerator<LiveBucket<T>> {
    for await (const identifier of this.toBucketIdentifiers()) {
      yield new LiveBucket({
        identifier,
        db: this._db,
        mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
      });
    }
  }

  async deleteEntryKey(entryKey: string): Promise<MetricResult<void>> {
    // empty

    return new MetricResult(undefined, undefined);
  }

  async rebuildEntry(entry: Entry<T>): Promise<MetricResult<void>> {
    // empty

    return new MetricResult(undefined, undefined);
  }
}
