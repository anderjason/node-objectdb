import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";

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
  db: DbInstance;
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

  load(): boolean {
    const row = this.props.db.toFirstRow(
      "SELECT data, createdAt, updatedAt FROM entries WHERE key = ?",
      [this.key]
    );

    if (row == null) {
      this.status = "new";
      return false;
    }

    const propertyValues = this.props.db.prepareCached("SELECT propertyKey, propertyValue FROM propertyValues WHERE entryKey = ?").all(this.key);

    this.data = JSON.parse(row.data);
    this.propertyValues = {};
    propertyValues.forEach((row) => {
      this.propertyValues[row.propertyKey] = JSON.parse(row.propertyValue);
    });
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

    this.props.db.prepareCached(
      `
      INSERT INTO entries (key, data, createdAt, updatedAt)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, createdAt=?, updatedAt=?;
      `
    ).run(
      [
        this.key,
        data,
        createdAtMs,
        updatedAtMs,
        data,
        createdAtMs,
        updatedAtMs,
      ]
    );

    this.props.db.prepareCached("DELETE FROM propertyValues WHERE entryKey = ?").run(this.key);
    
    const insertQuery = this.props.db.prepareCached(`
      INSERT INTO propertyValues (entryKey, propertyKey, propertyValue) 
      VALUES (?, ?, ?)
      ON CONFLICT(entryKey, propertyKey)
      DO UPDATE SET propertyValue=?;
    `)

    const deleteQuery = this.props.db.prepareCached("DELETE FROM propertyValues WHERE entryKey = ? AND propertyKey = ?");

    Object.keys(this.propertyValues).forEach((propertyKey) => {
      const value = this.propertyValues[propertyKey];
      if (value != null) {
        const valueStr = JSON.stringify(value);
        insertQuery.run(this.key, propertyKey, valueStr, valueStr);
      } else {
        deleteQuery.run(this.key, propertyKey);
      }
    });

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
