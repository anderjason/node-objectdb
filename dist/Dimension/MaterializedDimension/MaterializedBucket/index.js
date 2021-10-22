"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedBucket = void 0;
const Bucket_1 = require("../../Bucket");
class MaterializedBucket extends Bucket_1.Bucket {
    constructor() {
        super(...arguments);
        this._entryKeys = new Set();
    }
    onActivate() {
        this._entryKeys.clear();
        const storage = this.props.storage;
        if (storage != null && storage.entryKeys != null) {
            this._entryKeys.clear();
            for (const entryKey of storage.entryKeys) {
                this._entryKeys.add(entryKey);
            }
        }
    }
    async toEntryKeys() {
        return new Set(this._entryKeys);
    }
    async hasEntryKey(entryKey) {
        return this._entryKeys.has(entryKey);
    }
    addEntryKey(entryKey) {
        if (this._entryKeys.has(entryKey)) {
            return;
        }
        this._entryKeys.add(entryKey);
        this.didChange.emit();
    }
    deleteEntryKey(entryKey) {
        if (!this._entryKeys.has(entryKey)) {
            return;
        }
        this._entryKeys.delete(entryKey);
        this.didChange.emit();
    }
    async save() {
        const data = this.toPortableObject();
        if (this.props.dimension.db.isConnected.value == false) {
            console.error("Cannot save bucket because MongoDb is not connected");
            return;
        }
        await this.props.dimension.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: Object.assign({}, data),
        }, { upsert: true });
    }
    toPortableObject() {
        return {
            type: "MaterializedBucket",
            identifier: this.toAbsoluteIdentifier(),
            storage: {
                entryKeys: Array.from(this._entryKeys),
            },
        };
    }
}
exports.MaterializedBucket = MaterializedBucket;
//# sourceMappingURL=index.js.map