"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metric = void 0;
const PropsObject_1 = require("../PropsObject");
class Metric extends PropsObject_1.PropsObject {
    constructor(props) {
        super(props);
        this.entryMetricValues = {};
        if (props.metricKey == null) {
            throw new Error("metricKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        this.key = props.metricKey;
    }
    toOptionalValueGivenEntryKey(entryKey) {
        if (this.entryMetricValues == null) {
            return undefined;
        }
        return this.entryMetricValues[entryKey];
    }
    setEntryMetricValue(entryKey, value) {
        if (this.entryMetricValues == null) {
            this.entryMetricValues = {};
        }
        this.entryMetricValues[entryKey] = value;
    }
    hasValueGivenEntryKey(entryKey) {
        return this.toOptionalValueGivenEntryKey(entryKey) != null;
    }
    removeValueGivenEntryKey(metricKey) {
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
    save() {
        const { db } = this.props;
        // db.runTransaction(() => {
        this.props.db.runQuery(`
        DELETE FROM metricValues WHERE metricKey = ?
        `, [this.key]);
        if (Object.keys(this.entryMetricValues).length > 0) {
            db.runQuery(`
          INSERT OR IGNORE INTO metrics (key) VALUES (?)
          `, [this.key]);
        }
        else {
            db.runQuery(`
          DELETE FROM metrics
          WHERE key = ?
        `, [this.key]);
        }
        Object.keys(this.entryMetricValues).forEach(entryKey => {
            db.runQuery(`
          INSERT INTO metricValues
          (metricKey, entryKey, metricValue) 
          VALUES (?, ?, ?)
          `, [this.key, entryKey, this.entryMetricValues[entryKey]]);
        });
        // })
    }
}
exports.Metric = Metric;
//# sourceMappingURL=index.js.map