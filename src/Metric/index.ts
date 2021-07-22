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

  get entryMetricValues(): ReadOnlyMap<string, string> {
    this.loadOnce();

    if (this._readOnlyMetricValues == null) {
      this._readOnlyMetricValues = new ReadOnlyMap(this._entryMetricValues);
    }

    return this._readOnlyMetricValues;
  }

  private _entryMetricValues: Map<string, string>;  // this is initialized in loadOnce
  private _readOnlyMetricValues: ReadOnlyMap<string, string>;

  private _upsertEntryMetricValueQuery: Statement<[string, string, string]>;
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

    const { db } = this.props;

    this._upsertEntryMetricValueQuery = db.prepareCached(`
      INSERT INTO metricValues (metricKey, entryKey, metricValue)
      VALUES (?, ?, ?)
    `);

    this._deleteEntryMetricValueQuery = db.prepareCached(
      "DELETE FROM metricValues WHERE metricKey = ? AND entryKey = ?"
    );
  }

  onActivate() {}

  private loadOnce(): void {
    if (this._entryMetricValues != null) {
      return;
    }

    const { db } = this.props;

    db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)").run(
      this.key
    );

    const rows = db
      .prepareCached(
        "SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?"
      )
      .all(this.key);

    this._entryMetricValues = new Map<string, string>();
    rows.forEach((row) => {
      this._entryMetricValues.set(row.entryKey, row.metricValue);
    });
  }

  setValue(key: string, newValue: string): void {
    this.loadOnce();

    this._upsertEntryMetricValueQuery.run(this.key, key, newValue);
    this._entryMetricValues.set(key, newValue);
  }

  deleteKey(key: string): void {
    this.loadOnce();

    this._deleteEntryMetricValueQuery.run(this.key, key);
  }
}
