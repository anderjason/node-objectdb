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
        this._entryQueue = [];
        this._processing = false;
    }
    onActivate() {
        super.onActivate();
        this.cancelOnDeactivate(this.objectDb.entryDidChange.subscribe(async (change) => {
            this._entryQueue.push(change);
            this.processEntryQueue();
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
    async processEntryQueue() {
        if (this._processing) {
            return;
        }
        if (this._entryQueue.length === 0) {
            this._isUpdated.setValue(true);
            return;
        }
        this._isUpdated.setValue(false);
        this._processing = true;
        while (this._entryQueue.length > 0) {
            console.log(`Processing queue for dimension ${this.props.label} with length ${this._entryQueue.length}...`);
            try {
                const change = this._entryQueue.shift();
                if (change.newData != null) {
                    await this.rebuildEntry(change.entry);
                }
                else {
                    await this.deleteEntryKey(change.entry.key);
                }
            }
            catch (e) {
                console.error(e);
            }
            console.log(`Done processing queue item for dimension ${this.props.label}`);
        }
        this._processing = false;
        this._isUpdated.setValue(true);
    }
    async deleteEntryKey(entryKey) {
        for (const bucket of this._buckets.values()) {
            bucket.deleteEntryKey(entryKey);
        }
    }
    async save() {
        await super.save();
        await this.ensureUpdated();
    }
    async rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier) {
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
        await bucket.addEntryKey(entry.key);
    }
    async rebuildEntry(entry) {
        const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);
        if (Array.isArray(bucketIdentifiers)) {
            for (const bucketIdentifier of bucketIdentifiers) {
                if (bucketIdentifier != null) {
                    await this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifier);
                }
            }
            const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));
            for (const bucket of this._buckets.values()) {
                if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
                    await bucket.deleteEntryKey(entry.key);
                }
            }
        }
        else if (bucketIdentifiers != null) {
            // not an array, just a single object
            this.rebuildEntryGivenBucketIdentifier(entry, bucketIdentifiers);
            const bucketKey = bucketIdentifiers.bucketKey;
            for (const bucket of this._buckets.values()) {
                if (bucket.props.identifier.bucketKey != bucketKey) {
                    await bucket.deleteEntryKey(entry.key);
                }
            }
        }
        else {
            // undefined, delete all buckets
            for (const bucket of this._buckets.values()) {
                await bucket.deleteEntryKey(entry.key);
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