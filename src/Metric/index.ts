import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { ReadOnlyMap } from "../ReadOnlyMap";
import { DbInstance } from "../SqlClient";

export interface MetricProps {
  metricKey: string;
  db: DbInstance;
}

export class Metric extends Actor<MetricProps> {
  readonly key: string;

  get entryMetricValues(): ReadOnlyMap<string, number> {
    this.loadOnce();

    if (this._readOnlyMetricValues == null) {
      this._readOnlyMetricValues = new ReadOnlyMap(this._entryMetricValues);
    }

    return this._readOnlyMetricValues;
  }

  private _entryMetricValues = new Map<string, number>();
  private _readOnlyMetricValues: ReadOnlyMap<string, number>;
  
  private _upsertEntryMetricValueQuery: Statement<[string, string, number]>;
  private _deleteEntryMetricValueQuery: Statement<[string, string]>;

  constructor(props: MetricProps) {
    super(props);

    if (props.metricKey == null) {
      throw new Error("metricKey is required");
    }

    if (props.db == null) {
      throw new Error("db is required");
    }

    this.key = props.metricKey;
  }

  onActivate() {}

  private loadOnce(): void {
    const { db } = this.props;

    this._upsertEntryMetricValueQuery = db.prepareCached(`
        INSERT INTO metricValues (metricKey, entryKey, metricValue)
        VALUES (?, ?, ?)
      `);

    this._deleteEntryMetricValueQuery = db.prepareCached(
      "DELETE FROM metricValues WHERE metricKey = ? AND entryKey = ?"
    );

    db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)").run(
      this.key
    );

    const rows = db
      .prepareCached(
        "SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?"
      )
      .all(this.key);

    rows.forEach((row) => {
      this._entryMetricValues.set(row.entryKey, row.metricValue);
    });
  }

  setValue(key: string, newValue: number): void {
    this._upsertEntryMetricValueQuery.run(
      this.key,
      key,
      newValue
    );
    this._entryMetricValues.set(key, newValue);
  }

  deleteKey(key: string): void {
    this._deleteEntryMetricValueQuery.run(this.key, key);
  }
}
