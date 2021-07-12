import { UniqueId } from "@anderjason/node-crypto";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";

export interface PortableEntry<T> {
  key: string;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  data: T;
  label?: string;
}

export interface EntryProps<T> {
  key?: string;
  createdAt?: Instant;
  updatedAt?: Instant;
  label?: string;
  db: DbInstance;
}

export class Entry<T> extends PropsObject<EntryProps<T>> {
  readonly key: string;

  createdAt: Instant;
  updatedAt: Instant;
  data: T;
  label: string;

  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt || props.createdAt;
    this.label = props.label;
  }

  load(): boolean {
    const row = this.props.db.toFirstRow("SELECT data, label, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
    if (row == null) {
      return false;
    }

    this.data = JSON.parse(row.data);
    this.createdAt = Instant.givenEpochMilliseconds(row.createdAt);
    this.updatedAt = Instant.givenEpochMilliseconds(row.updatedAt);
    this.label = row.label;

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

    this.props.db.runQuery(
      `
      INSERT INTO entries (key, data, label, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, label=?, createdAt=?, updatedAt=?;
      `,
      [this.key, data, this.label, createdAtMs, updatedAtMs, data, this.label, createdAtMs, updatedAtMs]
    );
  }

  toPortableEntry(): PortableEntry<T> {
    return {
      key: this.key,
      createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
      updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
      data: this.data,
      label: this.label
    };
  }
}
