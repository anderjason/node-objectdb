import { Dict, ObservableDict } from "@anderjason/observable";
import { DbInstance } from "../SqlClient";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";

export interface MetricProps {
  metricKey: string;
  db: DbInstance;
}

export class Metric extends Actor<MetricProps> {
  readonly key: string;

  readonly entryMetricValues = ObservableDict.ofEmpty<number>();

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

  onActivate() {
    const { db } = this.props;

    this._upsertEntryMetricValueQuery = db.prepareCached(`
        INSERT INTO metricValues (metricKey, entryKey, metricValue)
        VALUES (?, ?, ?)
      `);

    this._deleteEntryMetricValueQuery = db.prepareCached(
      "DELETE FROM metricValues WHERE metricKey = ? AND entryKey = ?"
    );

    db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)")
      .run(this.key);

    const rows = db
      .prepareCached(
        "SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?"
      )
      .all(this.key);

    const values: Dict<number> = {};
    rows.forEach((row) => {
      values[row.entryKey] = row.metricValue;
    });

    this.entryMetricValues.sync(values);

    this.cancelOnDeactivate(
      this.entryMetricValues.didChangeSteps.subscribe((steps) => {
        steps.forEach((step) => {
          switch (step.type) {
            case "add":
            case "update":
              this._upsertEntryMetricValueQuery.run(
                this.key,
                step.key,
                step.newValue
              );
              break;
            case "remove":
              this._deleteEntryMetricValueQuery.run(this.key, step.key);
              break;
            default:
              break;
          }
        });
      })
    );
  }
}
