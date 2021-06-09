import { PropsObject } from "../PropsObject";
import { Dict } from "@anderjason/observable";
import { SqlClient } from "../SqlClient";

export interface MetricProps {
  metricKey: string;
  db: SqlClient;
}

export class Metric extends PropsObject<MetricProps> {
  readonly key: string;

  entryMetricValues: Dict<number> = {};

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

  toOptionalValueGivenEntryKey(entryKey: string): number | undefined {
    if (this.entryMetricValues == null) {
      return undefined;
    }

    return this.entryMetricValues[entryKey];
  }

  setEntryMetricValue(entryKey: string, value: number): void {
    if (this.entryMetricValues == null) {
      this.entryMetricValues = {};
    }

    this.entryMetricValues[entryKey] = value;
  }

  hasValueGivenEntryKey(entryKey: string): boolean {
    return this.toOptionalValueGivenEntryKey(entryKey) != null;
  }

  removeValueGivenEntryKey(metricKey: string): void {
    if (this.entryMetricValues == null) {
      return;
    }

    delete this.entryMetricValues[metricKey];
  }

  load() {
    const rows = this.props.db.toRows("SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?", [this.key]);
  
    this.entryMetricValues = {};
    rows.forEach(row => {
      this.entryMetricValues[row.entryKey] = row.metricValue;
    });
  }

  save(): void {
    const { db } = this.props;

    // db.runTransaction(() => {
      this.props.db.runQuery(
        `
        DELETE FROM metricValues WHERE metricKey = ?
        `,
        [this.key]
      );
  
      if (Object.keys(this.entryMetricValues).length > 0) {
        db.runQuery(
          `
          INSERT OR IGNORE INTO metrics (key) VALUES (?)
          `,
          [this.key]
        );
      } else {
        db.runQuery(
          `
          DELETE FROM metrics
          WHERE key = ?
        `,
          [this.key]
        );
      }

      Object.keys(this.entryMetricValues).forEach(entryKey => {
        db.runQuery(
          `
          INSERT INTO metricValues
          (metricKey, entryKey, metricValue) 
          VALUES (?, ?, ?)
          `,
          [this.key, entryKey, this.entryMetricValues[entryKey]]
        );
      })
    // })
  }
}
