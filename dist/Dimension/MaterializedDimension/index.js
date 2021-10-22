"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedDimension = void 0;
const __1 = require("..");
const Bucket_1 = require("../Bucket");
const MaterializedBucket_1 = require("./MaterializedBucket");
class MaterializedDimension extends __1.Dimension {
    constructor() {
        super(...arguments);
        this._bucketsByEntryKey = new Map();
        this._waitingForEntryKeys = new Set();
    }
    onActivate() {
        super.onActivate();
        this.cancelOnDeactivate(this.objectDb.entryDidChange.subscribe(async (change) => {
            if (change.newData != null) {
                this.entryDidChange(change.entry);
            }
            else {
                this.deleteEntryKey(change.key);
            }
        }));
    }
    async load() {
        // const row = await this.db.collection<any>("dimensions").findOne({ key: this.props.key });
        const bucketRows = await this.db
            .collection("buckets")
            .find({ "identifier.dimensionKey": this.props.key })
            .toArray();
        for (const bucketRow of bucketRows) {
            const bucket = new MaterializedBucket_1.MaterializedBucket({
                identifier: bucketRow.identifier,
                storage: bucketRow.storage,
                dimension: this,
            });
            this.addBucket(bucket);
        }
        this._isUpdated.setValue(true);
    }
    async entryDidChange(entry) {
        this._isUpdated.setValue(false);
        this._waitingForEntryKeys.add(entry.key);
        await this.rebuildEntry(entry);
        this._waitingForEntryKeys.delete(entry.key);
        if (this._waitingForEntryKeys.size === 0) {
            this._isUpdated.setValue(true);
        }
    }
    async deleteEntryKey(entryKey) {
        for (const bucket of this._buckets.values()) {
            bucket.deleteEntryKey(entryKey);
        }
    }
    rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier) {
        if ((0, Bucket_1.isAbsoluteBucketIdentifier)(bucketIdentifier)) {
            if (bucketIdentifier.dimensionKey !== this.props.key) {
                throw new Error(`Received an absolute bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`);
            }
        }
        // create the bucket if necessary
        if (!this._buckets.has(bucketIdentifier.bucketKey)) {
            const bucket = new MaterializedBucket_1.MaterializedBucket({
                identifier: bucketIdentifier,
                dimension: this,
            });
            this.addBucket(bucket);
        }
        const bucket = this._buckets.get(bucketIdentifier.bucketKey);
        bucket.addEntryKey(entry.key);
    }
    async rebuildEntry(entry) {
        const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);
        if (Array.isArray(bucketIdentifiers)) {
            for (const bucketIdentifier of bucketIdentifiers) {
                if (bucketIdentifier != null) {
                    this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier);
                }
            }
            const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));
            for (const bucket of this._buckets.values()) {
                if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
                    bucket.deleteEntryKey(entry.key);
                }
            }
        }
        else if (bucketIdentifiers != null) {
            // not an array, just a single object
            this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifiers);
            const bucketKey = bucketIdentifiers.bucketKey;
            for (const bucket of this._buckets.values()) {
                if (bucket.props.identifier.bucketKey != bucketKey) {
                    bucket.deleteEntryKey(entry.key);
                }
            }
        }
        else {
            // undefined, delete all buckets
            for (const bucket of this._buckets.values()) {
                bucket.deleteEntryKey(entry.key);
            }
        }
    }
    async rebuild() {
        await this.objectDb.forEach(async (entry) => {
            await this.rebuildEntry(entry);
        });
        this.save();
    }
}
exports.MaterializedDimension = MaterializedDimension;
//# sourceMappingURL=index.js.map