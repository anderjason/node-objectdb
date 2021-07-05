import { Dict, ObservableDict } from "@anderjason/observable";
import { DbInstance } from "../SqlClient";
import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { Duration, Instant } from "@anderjason/time";

export interface MetricProps {
  metricKey: string;
  db: DbInstance;
}

export class Metric extends Actor<MetricProps> {
  readonly key: string;

  get entryMetricValues(): ObservableDict<number> {
    this.loadOnce();

    return this._entryMetricValues;
  }

  private _entryMetricValues: ObservableDict<number>;
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

    const start = Instant.ofNow();

    const rows = db
      .prepareCached(
        "SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?"
      )
      .all(this.key);

    const values: Dict<number> = {};
    rows.forEach((row) => {
      values[row.entryKey] = row.metricValue;
    });

    this._entryMetricValues = ObservableDict.givenValues(values);

    const finish = Instant.ofNow();
    const duration = Duration.givenInstantRange(start, finish);
    console.log(
      `Loaded metric '${this.key}' (${rows.length}) in ${duration.toSeconds()}s`
    );

    this.cancelOnDeactivate(
      this._entryMetricValues.didChangeSteps.subscribe((steps) => {
        steps.forEach((step) => {
          if (
            step.newValue != null &&
            (step.type == "add" || step.type == "update")
          ) {
            this._upsertEntryMetricValueQuery.run(
              this.key,
              step.key,
              step.newValue
            );
          } else {
            this._deleteEntryMetricValueQuery.run(this.key, step.key);
          }
        });
      })
    );
  }
}
