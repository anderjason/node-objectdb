"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metric = void 0;
const skytree_1 = require("skytree");
class Metric extends skytree_1.Actor {
    constructor(props) {
        super(props);
        if (props.metricKey == null) {
            throw new Error("metricKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        this.key = props.metricKey;
    }
    onActivate() { }
    async toEntryMetricValues() {
        await this.loadOnce();
        return new Map(this._entryMetricValues);
    }
    async loadOnce() {
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
        this._entryMetricValues = new Map();
        // rows.forEach((row) => {
        //   this._entryMetricValues.set(row.entryKey, row.metricValue);
        // });
    }
    async setValue(key, newValue) {
        await this.loadOnce();
        this._entryMetricValues.set(key, newValue);
    }
    async deleteKey(key) {
        await this.loadOnce();
    }
}
exports.Metric = Metric;
//# sourceMappingURL=index.js.map