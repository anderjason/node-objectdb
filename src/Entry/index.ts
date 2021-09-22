import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";

export type EntryStatus = "unknown" | "new" | "saved" | "updated" | "deleted";

type JSONSerializable =
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
  db: DbInstance;
}

function mapGivenDict<T>(dict: Dict<T> = {}): Map<string, T> {
  const result = new Map<string, T>();
  for (const key of Object.keys(dict)) {
    result.set(key, dict[key]);
  }
  return result;
}

function dictGivenMap<T>(map: Map<string, T> = new Map()): Dict<T> {
  const result: Dict<T> = {};
  for (const [key, value] of map.entries()) {
    result[key] = value;
  }
  return result;
}

export class Entry<T> extends PropsObject<EntryProps<T>> {
  readonly key: string;

  createdAt: Instant;
  updatedAt: Instant;
  data: T;
  propertyValues: Map<string, JSONSerializable>;
  status: EntryStatus;

  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt || props.createdAt;
    this.status = "unknown";
  }

  load(): boolean {
    const row = this.props.db.toFirstRow(
      "SELECT data, createdAt, updatedAt FROM entries WHERE key = ?",
      [this.key]
    );
    if (row == null) {
      this.status = "new";
      return false;
    }

    this.data = JSON.parse(row.data);
    this.propertyValues = mapGivenDict(JSON.parse(row.propertyValues ?? "{}"));
    this.createdAt = Instant.givenEpochMilliseconds(row.createdAt);
    this.updatedAt = Instant.givenEpochMilliseconds(row.updatedAt);
    this.status = "saved";

    return true;
  }

  save(): void {
    const data = JSON.stringify(this.data);

    this.updatedAt = Instant.ofNow();

    if (this.createdAt == null) {
      this.createdAt = this.updatedAt;
    }

    const createdAtMs = this.createdAt.toEpochMilliseconds();
    const updatedAtMs = this.updatedAt.toEpochMilliseconds();
    const propertyValues = JSON.stringify(dictGivenMap(this.propertyValues));

    this.props.db.runQuery(
      `
      INSERT INTO entries (key, data, propertyValues, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, propertyValues=?, createdAt=?, updatedAt=?;
      `,
      [
        this.key,
        data,
        propertyValues,
        createdAtMs,
        updatedAtMs,
        data,
        propertyValues,
        createdAtMs,
        updatedAtMs,
      ]
    );

    this.status = "saved";
  }

  toPortableEntry(): PortableEntry<T> {
    return {
      key: this.key,
      createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
      updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
      data: this.data,
      propertyValues: dictGivenMap(this.propertyValues),
      status: this.status,
    };
  }
}
