import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../Dimension";
import { Entry, Metric, MetricResult, MongoDb } from "../..";
import { SelectProperty } from "../Select/SelectProperty";
import { LiveBucket } from "../../Dimension/LiveDimension/LiveBucket";

export interface IsSetDimensionProps {
  property: SelectProperty;
}

export class IsSetDimension<T>
  extends PropsObject<IsSetDimensionProps>
  implements Dimension<T>
{
  private _db: MongoDb;

  get key(): string {
    return `${this.props.property.definition.key}-isSet`;
  }

  get label(): string {
    return `${this.props.property.definition.label} is set`;
  }

  async init(db: MongoDb): Promise<void> {
    this._db = db;
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<MetricResult<Bucket | undefined>> {
    const metric = new Metric("IsSetDimension.toOptionalBucketGivenKey");

    const identifier = {
      dimensionKey: this.key,
      bucketKey,
      bucketLabel: bucketLabel ?? bucketKey,
    };

    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
    ]).toString();

    let mongoFilter: any;
    if (bucketKey === "true") {
      mongoFilter = {
        [fullPropertyValuePath]: { $exists: true, $ne: {} },
      };
    } else {
      mongoFilter = {
        $or: [
          {
            [fullPropertyValuePath]: { $exists: false },
          },
          {
            [fullPropertyValuePath]: { $eq: {} },
          },
        ],
      };
    }

    const result = new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter,
    });

    return new MetricResult(metric, result);
  }

  async deleteBucketKey(bucketKey: string): Promise<MetricResult<void>> {
    // empty

    return new MetricResult(undefined, undefined);
  }

  async toBucketIdentifiers(): Promise<BucketIdentifier[]> {
    return [
      {
        dimensionKey: this.key,
        bucketKey: "true",
        bucketLabel: "true",
      },
      {
        dimensionKey: this.key,
        bucketKey: "false",
        bucketLabel: "false",
      },
    ];
  }

  async *toBuckets(): AsyncGenerator<Bucket> {
    // TODO optimize
    const identifiers = await this.toBucketIdentifiers();

    for (const identifier of identifiers) {
      const bucketResult = await this.toOptionalBucketGivenKey(
        identifier.bucketKey,
        identifier.bucketLabel
      );

      const bucket = bucketResult.value;
      if (bucket != null) {
        yield bucket;
      }
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
