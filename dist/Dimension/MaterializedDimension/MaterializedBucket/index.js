"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedBucket = void 0;
const skytree_1 = require("skytree");
const __1 = require("../../..");
class MaterializedBucket extends skytree_1.PropsObject {
    get identifier() {
        return this.props.identifier;
    }
    async toEntryKeys() {
        var _a, _b;
        const metric = new __1.Metric("MaterializedBucket.toEntryKeys");
        const bucket = await this.props.db
            .collection("buckets")
            .findOne({ key: this.props.identifier.bucketKey });
        if (bucket == null) {
            return new __1.MetricResult(metric, new Set());
        }
        const entryKeys = (_a = bucket.entryKeys) !== null && _a !== void 0 ? _a : (_b = bucket.storage) === null || _b === void 0 ? void 0 : _b.entryKeys;
        return new __1.MetricResult(metric, new Set(entryKeys));
    }
    async hasEntryKey(entryKey) {
        const metric = new __1.Metric("MaterializedBucket.hasEntryKey");
        const bucket = await this.props.db.collection("buckets").findOne({
            key: this.props.identifier.bucketKey,
            entryKeys: entryKey,
        });
        const result = bucket != null;
        return new __1.MetricResult(metric, result);
    }
    async addEntryKey(entryKey) {
        const metric = new __1.Metric("MaterializedBucket.addEntryKey");
        await this.props.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: {
                identifier: this.props.identifier,
            },
            $push: { entryKeys: entryKey },
        }, { upsert: true });
        await this.props.db
            .collection("buckets")
            .findOne({ key: this.props.identifier.bucketKey });
        return new __1.MetricResult(metric, undefined);
    }
    async deleteEntryKey(entryKey) {
        const metric = new __1.Metric("MaterializedBucket.deleteEntryKey");
        await this.props.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $pull: { entryKeys: entryKey },
        });
        return new __1.MetricResult(metric, undefined);
    }
}
exports.MaterializedBucket = MaterializedBucket;
//# sourceMappingURL=index.js.map