import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { ObjectUtil } from "@anderjason/util";
import { PropsObject } from "skytree";
import { ObjectDb } from "..";
import { Metric, MetricResult } from "../Metric";
import { MongoDb } from "../MongoDb";

export type EntryStatus = "unknown" | "new" | "saved" | "updated" | "deleted";

export type JSONSerializable =
  | string
  | number
  | boolean
  | null
  | JSONSerializable[]
  | { [key: string]: JSONSerializable };

export interface PortableEntry<T> {
  key: string;
  createdAtEpochMs?: number;
  updatedAtEpochMs?: number;
  data: T;
  propertyValues: Dict<JSONSerializable>;
  status: EntryStatus;
  documentVersion?: number;
}

export interface EntryProps<T> {
  key?: string;
  createdAt?: Instant;
  updatedAt?: Instant;
  db: MongoDb;
  objectDb: ObjectDb<T>;
}

export class Entry<T> extends PropsObject<EntryProps<T>> {
  readonly key: string;

  createdAt?: Instant;
  updatedAt?: Instant;
  data: T;
  propertyValues: Dict<JSONSerializable>;
  status: EntryStatus;
  documentVersion: number | undefined;

  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt || props.createdAt;
    this.status = "unknown";
  }

  async load(): Promise<MetricResult<boolean>> {
    const metric = new Metric("Entry.load");

    const row = await this.props.db
      .collection<PortableEntry<T>>("entries")
      .findOne({ key: this.key });

    if (row == null) {
      this.status = "new";
      return new MetricResult(metric, false);
    }

    this.data = row.data;
    this.propertyValues = row.propertyValues;
    this.createdAt = Instant.givenEpochMilliseconds(row.createdAtEpochMs!);
    this.updatedAt = Instant.givenEpochMilliseconds(row.updatedAtEpochMs!);
    this.status = "saved";
    this.documentVersion = row.documentVersion;

    return new MetricResult(metric, true);
  }

  async save(): Promise<MetricResult<void>> {
    const metric = new Metric("Entry.save");

    this.updatedAt = Instant.ofNow();

    if (this.createdAt == null) {
      this.createdAt = this.updatedAt;
    }

    const createdAtMs = this.createdAt.toEpochMilliseconds();
    const updatedAtMs = this.updatedAt.toEpochMilliseconds();

    const newDocumentVersion =
      this.documentVersion == null ? 1 : this.documentVersion + 1;

    const result = await this.props.db
      .collection<PortableEntry<T>>("entries")
      .updateOne(
        { key: this.key, documentVersion: this.documentVersion },
        {
          $set: {
            key: this.key,
            createdAtEpochMs: createdAtMs,
            updatedAtEpochMs: updatedAtMs,
            data: this.data,
            propertyValues: this.propertyValues ?? {},
            status: this.status,
            documentVersion: newDocumentVersion,
          },
        },
        { upsert: true }
      );

    if (result.modifiedCount == 0 && result.upsertedCount == 0) {
      throw new Error(
        "Failed to save entry - could be a document version mismatch"
      );
    }

    this.status = "saved";

    return new MetricResult(metric, undefined);
  }

  toClone(): Entry<T> {
    const result = new Entry({
      key: this.key,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      db: this.props.db,
      objectDb: this.props.objectDb,
    });
    result.data = ObjectUtil.objectWithDeepMerge({}, this.data);
    result.propertyValues = ObjectUtil.objectWithDeepMerge(
      {},
      this.propertyValues
    );
    result.status = this.status;
    result.documentVersion = this.documentVersion;

    return result;
  }

  toPortableEntry(): PortableEntry<T> {
    return {
      key: this.key,
      createdAtEpochMs:
        this.createdAt != null
          ? this.createdAt.toEpochMilliseconds()
          : undefined,
      updatedAtEpochMs:
        this.updatedAt != null
          ? this.updatedAt.toEpochMilliseconds()
          : undefined,
      data: this.data,
      propertyValues: this.propertyValues ?? {},
      status: this.status,
      documentVersion: this.documentVersion,
    };
  }
}
