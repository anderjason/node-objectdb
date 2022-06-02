"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveBucket = void 0;
const skytree_1 = require("skytree");
const __1 = require("../../..");
const Metric_1 = require("../../../Metric");
class LiveBucket extends skytree_1.PropsObject {
    get identifier() {
        return this.props.identifier;
    }
    async toEntryKeys() {
        const metric = new Metric_1.Metric("LiveBucket.toEntryKeys");
        const rows = await this.props.db
            .collection("entries")
            .find(this.props.mongoFilter, {
            projection: {
                _id: 0,
                key: 1,
            },
        })
            .collation({ locale: "en", strength: 2 })
            .toArray();
        const entryKeys = rows.map((row) => row.key);
        const result = new Set(entryKeys);
        return new __1.MetricResult(metric, result);
    }
    async hasEntryKey(entryKey) {
        const metric = new Metric_1.Metric("LiveBucket.hasEntryKey");
        const bucket = await this.props.db.collection("entries").findOne(Object.assign({ key: entryKey }, this.props.mongoFilter));
        const result = bucket != null;
        return new __1.MetricResult(metric, result);
    }
}
exports.LiveBucket = LiveBucket;
//# sourceMappingURL=index.js.map