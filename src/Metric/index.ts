import { Statement } from "better-sqlite3";
import { Actor } from "skytree";
import { MongoDb } from "..";

export interface MetricProps {
  metricKey: string;
  db: MongoDb;
}

export class Metric extends Actor<MetricProps> {
  readonly key: string;

  private _entryMetricValues: Map<string, string>;  // this is initialized in loadOnce

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
  }

  onActivate() {}

  async toEntryMetricValues(): Promise<Map<string, string>> {
    await this.loadOnce();

    return new Map(this._entryMetricValues);
  }

  private async loadOnce(): Promise<void> {
    if (this._entryMetricValues != null) {
      return;
    }

    const { db } = this.props;


    // db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)").run(
    //   this.key
    // );

    // const rows = db
    //   .prepareCached(
    //     "SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?"
    //   )
    //   .all(this.key);

    this._entryMetricValues = new Map<string, string>();
    // rows.forEach((row) => {
    //   this._entryMetricValues.set(row.entryKey, row.metricValue);
    // });
  }

  async setValue(key: string, newValue: string): Promise<void> {
    await this.loadOnce();

    this._entryMetricValues.set(key, newValue);
  }

  async deleteKey(key: string): Promise<void> {
    await this.loadOnce();
  }
}
