import { UniqueId } from "@anderjason/node-crypto";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";

export type EntryStatus = "unknown" | "new" | "saved" | "updated" | "deleted";

export interface PortableEntry<T> {
  key: string;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  data: T;
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
  status: EntryStatus;

  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt || props.createdAt;
    this.status = "unknown";
  }

  load(): boolean {
    const row = this.props.db.toFirstRow("SELECT data, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
    if (row == null) {
      this.status = "new";
      return false;
    }

    this.data = JSON.parse(row.data);
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

    this.props.db.runQuery(
      `
      INSERT INTO entries (key, data, createdAt, updatedAt)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, createdAt=?, updatedAt=?;
      `,
      [this.key, data, createdAtMs, updatedAtMs, data, createdAtMs, updatedAtMs]
    );

    this.status = "saved";
  }

  toPortableEntry(): PortableEntry<T> {
    return {
      key: this.key,
      createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
      updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
      data: this.data,
      status: this.status
    };
  }
}
