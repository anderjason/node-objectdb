import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";

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
  
  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt || Instant.ofNow();
    this.updatedAt = props.updatedAt || props.createdAt || Instant.ofNow();
  }

  load(): boolean {
    const row = this.props.db.toFirstRow("SELECT data, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
    if (row == null) {
      return false;
    }

    this.data = JSON.parse(row.data);
    this.createdAt = Instant.givenEpochMilliseconds(row.createdAt);
    this.updatedAt = Instant.givenEpochMilliseconds(row.updatedAt);

    return true;
  }

  save(): void {
    const data = JSON.stringify(this.data);

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
  }
}
