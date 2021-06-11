"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metric = void 0;
const observable_1 = require("@anderjason/observable");
const skytree_1 = require("skytree");
class Metric extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this.entryMetricValues = observable_1.ObservableDict.ofEmpty();
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
        this._deleteEntryMetricValueQuery = db.prepareCached("DELETE FROM metricValues WHERE metricKey = ? AND entryKey = ?");
        db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)")
            .run(this.key);
        const rows = db
            .prepareCached("SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?")
            .all(this.key);
        const values = {};
        rows.forEach((row) => {
            values[row.entryKey] = row.metricValue;
        });
        this.entryMetricValues.sync(values);
        this.cancelOnDeactivate(this.entryMetricValues.didChangeSteps.subscribe((steps) => {
            steps.forEach((step) => {
                switch (step.type) {
                    case "add":
                    case "update":
                        this._upsertEntryMetricValueQuery.run(this.key, step.key, step.newValue);
                        break;
                    case "remove":
                        this._deleteEntryMetricValueQuery.run(this.key, step.key);
                        break;
                    default:
                        break;
                }
            });
        }));
    }
}
exports.Metric = Metric;
//# sourceMappingURL=index.js.map