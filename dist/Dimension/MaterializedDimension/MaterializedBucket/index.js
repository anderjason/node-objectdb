"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedBucket = void 0;
const skytree_1 = require("skytree");
class MaterializedBucket extends skytree_1.PropsObject {
    get identifier() {
        return this.props.identifier;
    }
    async toEntryKeys() {
        var _a, _b;
        const bucket = await this.props.db
            .collection("buckets")
            .findOne({ key: this.props.identifier.bucketKey });
        if (bucket == null) {
            return new Set();
        }
        const entryKeys = (_a = bucket.entryKeys) !== null && _a !== void 0 ? _a : (_b = bucket.storage) === null || _b === void 0 ? void 0 : _b.entryKeys;
        return new Set(entryKeys);
    }
    async hasEntryKey(entryKey) {
        const bucket = await this.props.db.collection("buckets").findOne({
            key: this.props.identifier.bucketKey,
            entryKeys: entryKey,
        });
        return bucket != null;
    }
    async addEntryKey(entryKey) {
        await this.props.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: {
                identifier: this.props.identifier,
            },
            $push: { entryKeys: entryKey },
        }, { upsert: true });
        await this.props.db
            .collection("buckets")
            .findOne({ key: this.props.identifier.bucketKey });
    }
    async deleteEntryKey(entryKey) {
        await this.props.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $pull: { entryKeys: entryKey },
        });
    }
}
exports.MaterializedBucket = MaterializedBucket;
//# sourceMappingURL=index.js.map