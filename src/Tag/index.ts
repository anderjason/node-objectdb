import { PropsObject } from "../PropsObject";
import { SqlClient } from "../SqlClient";

export interface TagProps {
  tagKey: string;
  db: SqlClient;
}

export class Tag extends PropsObject<TagProps> {
  readonly tagPrefix: string;
  readonly tagValue: string;
  readonly key: string;

  entryKeys = new Set<string>();

  constructor(props: TagProps) {
    super(props);

    if (props.tagKey == null) {
      throw new Error("tagKey is required");
    }

    if (props.db == null) {
      throw new Error("db is required");
    }

    if (!props.tagKey.includes(":")) {
      throw new Error(`Tags must be in the form PREFIX:VALUE (got '${props.tagKey}')`);
    }

    this.key = props.tagKey;

    const parts = props.tagKey.split(":");
    this.tagPrefix = parts[0];
    this.tagValue = parts[1];
  }

  load(): void {
    const rows = this.props.db.toRows("SELECT entryKey FROM tagEntries WHERE tagKey = ?", [this.key]);
  
    this.entryKeys = new Set(rows.map(row => row.entryKey));
  }

  save(): void {
    const { db } = this.props;

    db.runTransaction(() => {
      this.props.db.runQuery(
        `
        DELETE FROM tagEntries WHERE tagKey = ?
        `,
        [this.key]
      );
  
      if (this.entryKeys.size > 0) {
        db.runQuery(
          `
          INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)
          `,
          [this.key, this.tagPrefix, this.tagValue]
        );
      } else {
        db.runQuery(
          `
          DELETE FROM tags
          WHERE key = ?
        `,
          [this.key]
        );
      }
  
      this.entryKeys.forEach(entryKey => {
        db.runQuery(
          `
          INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)
          `,
          [this.key, entryKey]
        );
      })
    })
  }
}
