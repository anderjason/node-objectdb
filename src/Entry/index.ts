import { UniqueId } from "@anderjason/node-crypto";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PortableEntry } from "../ObjectDb/Types";
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
  tagKeys: string[];
  metricValues: Dict<number>;
  
  constructor(props: EntryProps<T>) {
    super(props);

    this.key = props.key || UniqueId.ofRandom().toUUIDString();
    this.createdAt = props.createdAt || Instant.ofNow();
    this.updatedAt = props.updatedAt || props.createdAt || Instant.ofNow();
  }

  load(): boolean {
    const row = this.props.db.toFirstRow("SELECT data FROM entries WHERE key = ?", [this.key]);
    if (row == null) {
      return false;
    }

    const portableEntry: PortableEntry = JSON.parse(row.data);
    this.data = portableEntry.data;
    this.createdAt = Instant.givenEpochMilliseconds(portableEntry.createdAtMs);
    this.updatedAt = Instant.givenEpochMilliseconds(portableEntry.updatedAtMs);
    this.tagKeys = portableEntry.tagKeys || [];
    this.metricValues = portableEntry.metricValues || {};

    return true;
  }

  save(): void {
    const data = JSON.stringify(this.toPortableObject());

    this.props.db.runQuery(
      `
      INSERT INTO entries (key, data)
      VALUES(?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?;
      `,
      [this.key, data, data]
    );
  }
  
  toPortableObject(): PortableEntry {
    return {
      key: this.key,
      tagKeys: this.tagKeys || [],
      metricValues: this.metricValues || {},
      createdAtMs: this.createdAt.toEpochMilliseconds(),
      updatedAtMs: this.updatedAt.toEpochMilliseconds(),
      data: this.data,
    };
  }
}
