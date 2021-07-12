"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metric = void 0;
const skytree_1 = require("skytree");
const ReadOnlyMap_1 = require("../ReadOnlyMap");
class Metric extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this._entryMetricValues = new Map();
        if (props.metricKey == null) {
            throw new Error("metricKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        this.key = props.metricKey;
    }
    get entryMetricValues() {
        this.loadOnce();
        if (this._readOnlyMetricValues == null) {
            this._readOnlyMetricValues = new ReadOnlyMap_1.ReadOnlyMap(this._entryMetricValues);
        }
        return this._readOnlyMetricValues;
    }
    onActivate() { }
    loadOnce() {
        const { db } = this.props;
        this._upsertEntryMetricValueQuery = db.prepareCached(`
        INSERT INTO metricValues (metricKey, entryKey, metricValue)
        VALUES (?, ?, ?)
      `);
        this._deleteEntryMetricValueQuery = db.prepareCached("DELETE FROM metricValues WHERE metricKey = ? AND entryKey = ?");
        db.prepareCached("INSERT OR IGNORE INTO metrics (key) VALUES (?)").run(this.key);
        const rows = db
            .prepareCached("SELECT entryKey, metricValue FROM metricValues WHERE metricKey = ?")
            .all(this.key);
        rows.forEach((row) => {
            this._entryMetricValues.set(row.entryKey, row.metricValue);
        });
    }
    setValue(key, newValue) {
        this._upsertEntryMetricValueQuery.run(this.key, key, newValue);
        this._entryMetricValues.set(key, newValue);
    }
    deleteKey(key) {
        this._deleteEntryMetricValueQuery.run(this.key, key);
    }
}
exports.Metric = Metric;
//# sourceMappingURL=index.js.map