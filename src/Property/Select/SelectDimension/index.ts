import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../../Dimension";
import { Entry, Metric, MetricResult, MongoDb } from "../../..";
import { SelectProperty } from "../SelectProperty";
import { LiveBucket } from "../../../Dimension/LiveDimension/LiveBucket";

export interface SelectDimensionProps {
  property: SelectProperty;
}

export class SelectDimension<T>
  extends PropsObject<SelectDimensionProps>
  implements Dimension<T>
{
  private _db: MongoDb;

  get key(): string {
    return this.props.property.definition.key;
  }

  get label(): string {
    return this.props.property.definition.label;
  }

  async init(db: MongoDb): Promise<void> {
    this._db = db;
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<MetricResult<Bucket | undefined>> {
    const metric = new Metric("SelectDimension.toOptionalBucketGivenKey");

    const identifier = {
      dimensionKey: this.key,
      bucketKey,
      bucketLabel: bucketLabel ?? bucketKey,
    };

    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
      bucketKey,
    ]).toString();

    const result = new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter: {
        [fullPropertyValuePath]: 1,
      },
    });

    return new MetricResult(metric, result);
  }

  async deleteBucketKey(bucketKey: string): Promise<MetricResult<void>> {
    const metric = new Metric("SelectDimension.deleteBucketKey");

    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
      bucketKey,
    ]).toString();

    await this._db.collection("entries").updateMany(
      {
        [fullPropertyValuePath]: 1,
      },
      {
        $unset: {
          [fullPropertyValuePath]: 1,
        },
      }
    );

    return new MetricResult(metric, undefined);
  }

  async *toBucketIdentifiers(): AsyncGenerator<BucketIdentifier> {
    for (const option of this.props.property.definition.options) {
      yield {
        dimensionKey: this.key,
        bucketKey: option.key,
        bucketLabel: option.label,
      };
    }
  }

  async *toBuckets(): AsyncGenerator<Bucket> {
    for await (const identifier of this.toBucketIdentifiers()) {
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
