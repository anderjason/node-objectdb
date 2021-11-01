import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "..";
import { Entry, MongoDb } from "../..";
import { SelectProperty } from "../../Property/SelectProperty";
import { LiveBucket } from "../LiveDimension/LiveBucket";

export interface SelectPropertyDimensionProps {
  property: SelectProperty;
}

export class SelectPropertyDimension<T>
  extends PropsObject<SelectPropertyDimensionProps>
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
    bucketKey: string
  ): Promise<Bucket | undefined> {
    const identifier = {
      dimensionKey: this.key,
      bucketKey,
      bucketLabel: bucketKey,
    };

    const fullPropertyValuePath = ValuePath.givenParts([
      "propertyValues",
      this.props.property.definition.key,
    ]).toString();

    return new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter: {
        [fullPropertyValuePath]: bucketKey,
      },
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

  async toBuckets(): Promise<LiveBucket<T>[]> {
    const bucketIdentifiers = await this.toBucketIdentifiers();

    const result: LiveBucket<T>[] = [];

    const timer2 = this._stopwatch.start("ld-toBuckets-loop");
    for (const identifier of bucketIdentifiers) {
      const fullPropertyValuePath = ValuePath.givenParts([
        "propertyValues",
        this.props.property.definition.key,
      ]).toString();

      const mongoFilter = {
        [fullPropertyValuePath]: identifier.bucketKey
      };

      result.push(
        new LiveBucket({
          identifier,
          db: this._db,
          mongoFilter,
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
