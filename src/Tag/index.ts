import { ObservableSet } from "@anderjason/observable";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { DbInstance } from "../SqlClient";

export interface TagProps {
  tagKey: string;
  db: DbInstance;
}

export class Tag extends Actor<TagProps> {
  readonly tagPrefix: string;
  readonly tagValue: string;
  readonly key: string;

  readonly entryKeys = ObservableSet.ofEmpty<string>();

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
  }

  onActivate() {
    const { db } = this.props;

    this._insertEntryKeyQuery = db.connection
      .prepare<[string, string]>("INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)");

    this._deleteEntryKeyQuery = db.connection
      .prepare<[string, string]>("DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?");

    db.connection
      .prepare("INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)")
      .run(this.key, this.tagPrefix, this.tagValue);

    const rows = db.connection
      .prepare<[string]>("SELECT entryKey FROM tagEntries WHERE tagKey = ?")
      .all(this.key);

    this.entryKeys.sync(rows.map((row) => row.entryKey));

    this.cancelOnDeactivate(
      this.entryKeys.didChangeSteps.subscribe(steps => {
        steps.forEach(step => {
          switch (step.type) {
            case "add":
              this._insertEntryKeyQuery.run(this.key, step.value);
              break;
            case "remove":
              this._deleteEntryKeyQuery.run(this.key, step.value);
              break;
            default:
              break;
          }
        })
      })
    );
  }
}
