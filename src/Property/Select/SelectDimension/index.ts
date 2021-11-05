import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../../Dimension";
import { Entry, MongoDb } from "../../..";
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
  private _stopwatch: Stopwatch;

  get key(): string {
    return this.props.property.definition.key;
  }

  get label(): string {
    return this.props.property.definition.label;
  }

  async init(db: MongoDb, stopwatch: Stopwatch): Promise<void> {
    this._db = db;
    this._stopwatch = stopwatch;
  }

  async toOptionalBucketGivenKey(
    bucketKey: string,
    bucketLabel?: string
  ): Promise<Bucket | undefined> {
    const identifier = {
      dimensionKey: this.key,
      bucketKey,
      bucketLabel: bucketLabel ?? bucketKey,
    };

    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
      bucketKey
    ]).toString();

    return new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter: {
        [fullPropertyValuePath]: 1,
      },
    });
  }

  async deleteBucketKey(bucketKey: string): Promise<void> {
    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
      bucketKey
    ]).toString();

    await this._db.collection("entries").updateMany({
      [fullPropertyValuePath]: 1
    }, {
      $unset: {
        [fullPropertyValuePath]: 1
      }
    });
  }

  async toBucketIdentifiers(): Promise<BucketIdentifier[]> {
    return this.props.property.definition.options.map((option) => {
      return {
        dimensionKey: this.key,
        bucketKey: option.key,
        bucketLabel: option.label,
      };
    });
  }

  async toBuckets(): Promise<Bucket[]> {
    const bucketIdentifiers = await this.toBucketIdentifiers();

    const result: Bucket[] = [];
    
    const timer2 = this._stopwatch.start("spd-toBuckets-loop");
    for (const identifier of bucketIdentifiers) {
      const bucket = await this.toOptionalBucketGivenKey(identifier.bucketKey, identifier.bucketLabel);

      result.push(bucket);      
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
