import { Stopwatch } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";
import { TagPrefix } from "../TagPrefix";
import { PortableTag } from "./PortableTag";

export interface TagProps {
  tagKey: string;
  tagPrefix: TagPrefix;
  label: string;
  db: DbInstance;
  stopwatch: Stopwatch;

  normalizedLabel?: string;
}

export function normalizedValueGivenString(tagValue: string): string {
  return tagValue.toLowerCase();
}

export function hashCodeGivenTagPrefixAndNormalizedValue(tagPrefix: string, normalizedValue: string): number {
  return StringUtil.hashCodeGivenString(tagPrefix + normalizedValue);
}

export class Tag extends Actor<TagProps> {
  readonly key: string;
  readonly tagPrefix: TagPrefix;
  readonly label: string;
  readonly normalizedLabel: string;

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

    const normalizedLabel = props.normalizedLabel ?? normalizedValueGivenString(props.label);

    this.key = props.tagKey;
    this.tagPrefix = props.tagPrefix;
    this.label = props.label;
    this.normalizedLabel = normalizedLabel;

    const { db } = this.props;

    if (props.normalizedLabel == null) {
      db.prepareCached(
        "UPDATE tags SET normalizedLabel = ? WHERE key = ?"
      ).run(normalizedLabel, this.key);
    }

    this.props.stopwatch.start("tag:prepareCached");
    this._insertEntryKeyQuery = db.prepareCached(
      "INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)"
    );
    this._deleteEntryKeyQuery = db.prepareCached(
      "DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?"
    );
    this.props.stopwatch.stop("tag:prepareCached");
  }

  private loadOnce(): void {
    if (this._entryKeys != null) {
      return;
    }

    this.props.stopwatch.start("tag:loadOnce");

    const { db } = this.props;

    this.props.stopwatch.start("tag:insertIntoTags");
    db.prepareCached(
      "INSERT OR IGNORE INTO tags (key, tagPrefixKey, label, normalizedLabel) VALUES (?, ?, ?, ?)"
    ).run(this.key, this.tagPrefix.key, this.label, this.normalizedLabel);
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

  addEntryKey(entryKey: string): void {
    this.loadOnce();

    this.props.stopwatch.start("tag:addValue");
    this._insertEntryKeyQuery.run(this.key, entryKey);
    this._entryKeys.add(entryKey);
    this.props.stopwatch.stop("tag:addValue");
  }

  deleteEntryKey(entryKey: string): void {
    this.loadOnce();

    this._entryKeys.delete(entryKey);
    this._deleteEntryKeyQuery.run(this.key, entryKey);
  }

  toHashCode(): number {
    return hashCodeGivenTagPrefixAndNormalizedValue(this.tagPrefix.normalizedLabel, this.normalizedLabel);
  }

  toPortableTag(): PortableTag {
    return {
      tagPrefixLabel: this.tagPrefix.label,
      tagLabel: this.label,
    };
  }
}
