import { Stopwatch } from "@anderjason/time";
import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Bucket, BucketIdentifier, Dimension } from "../../Dimension";
import { Entry, MongoDb } from "../..";
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
  private _stopwatch: Stopwatch;

  get key(): string {
    return `${this.props.property.definition.key}-isSet`;
  }

  get label(): string {
    return `${this.props.property.definition.label} is set`;
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

    return new LiveBucket({
      identifier,
      db: this._db,
      mongoFilter,
    });
  }

  async deleteBucketKey(bucketKey: string): Promise<void> {
    // empty
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
      const bucket = await this.toOptionalBucketGivenKey(
        identifier.bucketKey,
        identifier.bucketLabel
      );

      yield bucket;
    }
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    // empty
  }

  async rebuildEntry(entry: Entry<T>): Promise<void> {
    // empty
  }
}
