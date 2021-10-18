import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { ObjectDb } from "..";
import { PropsObject } from "../PropsObject";
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
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  data: T;
  propertyValues: Dict<JSONSerializable>;
  status: EntryStatus;
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

  createdAt: Instant;
  updatedAt: Instant;
  data: T;
  propertyValues: Dict<JSONSerializable>;
  status: EntryStatus;

  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt || props.createdAt;
    this.status = "unknown";
  }

  async load(): Promise<boolean> {
    const row = await this.props.db.collection<PortableEntry<T>>("entries").findOne({ key: this.key });
    
    if (row == null) {
      this.status = "new";
      return false;
    }

    this.data = row.data;
    this.createdAt = Instant.givenEpochMilliseconds(row.createdAtEpochMs);
    this.updatedAt = Instant.givenEpochMilliseconds(row.updatedAtEpochMs);
    this.status = "saved";

    return true;
  }

  async save(): Promise<void> {
    this.updatedAt = Instant.ofNow();

    if (this.createdAt == null) {
      this.createdAt = this.updatedAt;
    }

    const createdAtMs = this.createdAt.toEpochMilliseconds();
    const updatedAtMs = this.updatedAt.toEpochMilliseconds();

    await this.props.db.collection<PortableEntry<T>>("entries").updateOne(
      { key: this.key },
      {
        $set: {
          key: this.key,
          createdAtEpochMs: createdAtMs,
          updatedAtEpochMs: updatedAtMs,
          data: this.data,
          propertyValues: this.propertyValues ?? {},
          status: this.status,
        },
      },
      { upsert: true }
    );

    this.status = "saved";
  }

  toPortableEntry(): PortableEntry<T> {
    return {
      key: this.key,
      createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
      updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
      data: this.data,
      propertyValues: this.propertyValues ?? {},
      status: this.status,
    };
  }
}
