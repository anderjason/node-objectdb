"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedBucket = void 0;
const Bucket_1 = require("../../Bucket");
class MaterializedBucket extends Bucket_1.Bucket {
    async toEntryKeys() {
        if (this.props.dimension.db.isConnected.value == false) {
            console.error("Cannot get entry keys in MaterializedBucket because MongoDb is not connected");
            return new Set();
        }
        const bucket = await this.props.dimension.db
            .collection("buckets")
            .findOne({ key: this.props.identifier.bucketKey });
        if (bucket == null) {
            return new Set();
        }
        const entryKeys = bucket.entryKeys;
        return new Set(entryKeys);
    }
    async hasEntryKey(entryKey) {
        const entryKeys = await this.toEntryKeys();
        return entryKeys.has(entryKey);
    }
    async addEntryKey(entryKey) {
        const entryKeys = await this.toEntryKeys();
        if (entryKeys.has(entryKey)) {
            return;
        }
        entryKeys.add(entryKey);
        await this.props.dimension.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: {
                identifier: this.toAbsoluteIdentifier(),
                entryKeys: Array.from(entryKeys),
            },
        }, { upsert: true });
        this.didChange.emit();
    }
    async deleteEntryKey(entryKey) {
        const entryKeys = await this.toEntryKeys();
        if (!entryKeys.has(entryKey)) {
            return;
        }
        entryKeys.delete(entryKey);
        await this.props.dimension.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: {
                identifier: this.toAbsoluteIdentifier(),
                entryKeys: Array.from(entryKeys),
            },
        }, { upsert: true });
        this.didChange.emit();
    }
}
exports.MaterializedBucket = MaterializedBucket;
//# sourceMappingURL=index.js.map