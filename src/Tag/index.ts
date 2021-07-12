import { Stopwatch } from "@anderjason/time";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";

export interface TagProps {
  tagKey: string;
  db: DbInstance;
  stopwatch: Stopwatch;
}

export class Tag extends Actor<TagProps> {
  readonly tagPrefix: string;
  readonly tagValue: string;
  readonly key: string;

  get entryKeys(): ReadOnlySet<string> {
    this.loadOnce();

    if (this._readOnlyEntryKeys == null) {
      this._readOnlyEntryKeys = new ReadOnlySet(this._entryKeys);
    }

    return this._readOnlyEntryKeys;
  }

  private _entryKeys: Set<string>;  // this is initialized in loadOnce
  private _readOnlyEntryKeys: ReadOnlySet<string>;

  private _insertEntryKeyQuery: Statement<[string, string]>;
  private _deleteEntryKeyQuery: Statement<[string, string]>;
  
  constructor(props: TagProps) {
    super(props);

    if (props.tagKey == null) {
      throw new Error("tagKey is required");
    }

    if (props.db == null) {
      throw new Error("db is required");
    }

    if (!props.tagKey.includes(":")) {
      throw new Error(
        `Tags must be in the form PREFIX:VALUE (got '${props.tagKey}')`
      );
    }

    this.key = props.tagKey;

    const parts = props.tagKey.split(":");
    this.tagPrefix = parts[0];
    this.tagValue = parts[1];

    const { db } = this.props;

    this._insertEntryKeyQuery = db.prepareCached(
      "INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)"
    );
    this._deleteEntryKeyQuery = db.prepareCached(
      "DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?"
    );
  }

  private loadOnce(): void {
    if (this._entryKeys != null) {
      return;
    }

    this.props.stopwatch.start("tag:loadOnce");

    const { db } = this.props;

    this.props.stopwatch.start("tag:insertIntoTags");
    db.prepareCached(
      "INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)"
    ).run(this.key, this.tagPrefix, this.tagValue);
    this.props.stopwatch.stop("tag:insertIntoTags");

    this.props.stopwatch.start("tag:selectEntryKeys");
    const rows = db
      .prepareCached("SELECT entryKey FROM tagEntries WHERE tagKey = ?")
      .all(this.key);
    this.props.stopwatch.stop("tag:selectEntryKeys");

    this.props.stopwatch.start("tag:createSet");
    this._entryKeys = new Set(
      rows.map((row) => row.entryKey)
    );
    this.props.stopwatch.stop("tag:createSet");

    this.props.stopwatch.stop("tag:loadOnce");
  }

  addValue(value: string): void {
    this.loadOnce();

    this.props.stopwatch.start("tag:addValue");
    this._insertEntryKeyQuery.run(this.key, value);
    this._entryKeys.add(value);
    this.props.stopwatch.stop("tag:addValue");
  }

  deleteValue(value: string): void {
    this.loadOnce();

    this._entryKeys.delete(value);
    this._deleteEntryKeyQuery.run(this.key, value);
  }
}
