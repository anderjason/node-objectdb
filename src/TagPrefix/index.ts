import { Stopwatch } from "@anderjason/time";
import { StringUtil } from "@anderjason/util";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";

export interface TagPrefixProps {
  tagPrefixKey: string;
  label: string;
  db: DbInstance;
  stopwatch: Stopwatch;

  normalizedLabel?: string;
}

export function normalizedValueGivenString(tagValue: string): string {
  return tagValue.toLowerCase();
}

export class TagPrefix extends Actor<TagPrefixProps> {
  readonly key: string;
  readonly label: string;
  readonly normalizedLabel: string;

  constructor(props: TagPrefixProps) {
    super(props);

    if (props.tagPrefixKey == null) {
      throw new Error("tagPrefixKey is required");
    }

    if (props.db == null) {
      throw new Error("db is required");
    }

    this.key = props.tagPrefixKey;
    this.label = props.label;
    this.normalizedLabel = props.normalizedLabel ?? normalizedValueGivenString(props.label);
  }

  onActivate() {
    this.loadOnce();
  }

  private loadOnce(): void {
    this.props.stopwatch.start("tagPrefix:loadOnce");

    const { db } = this.props;

    this.props.stopwatch.start("tagPrefix:insertIntoTagPrefixes");
    db.prepareCached(
      "INSERT OR IGNORE INTO tagPrefixes (key, label, normalizedLabel) VALUES (?, ?, ?)"
    ).run(this.key, this.label, this.normalizedLabel);
    this.props.stopwatch.stop("tagPrefix:insertIntoTagPrefixes");

    this.props.stopwatch.stop("tagPrefix:loadOnce");
  }
}
