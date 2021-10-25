"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedDimension = void 0;
const PropsObject_1 = require("../../PropsObject");
const MaterializedBucket_1 = require("./MaterializedBucket");
class MaterializedDimension extends PropsObject_1.PropsObject {
    constructor() {
        super(...arguments);
        this._bucketsByEntryKey = new Map();
    }
    get key() {
        return this.props.key;
    }
    get label() {
        return this.props.label;
    }
    async toOptionalBucketGivenKey(bucketKey) {
        const find = {
            "identifier.dimensionKey": this.props.key,
            "identifier.bucketKey": bucketKey,
        };
        const bucketRow = await this.db.collection("buckets").findOne(find);
        if (bucketRow == null) {
            return undefined;
        }
        return new MaterializedBucket_1.MaterializedBucket({
            identifier: bucketRow.identifier,
            db: this.db,
        });
    }
    async toBuckets() {
        const bucketRows = await this.db
            .collection("buckets")
            .find({ "identifier.dimensionKey": this.props.key })
            .toArray();
        const result = [];
        for (const row of bucketRows) {
            result.push(new MaterializedBucket_1.MaterializedBucket({
                identifier: row.identifier,
                db: this.db,
            }));
        }
        return result;
    }
    async deleteEntryKey(entryKey) {
        await this.db.collection("buckets").updateMany({ "identifier.dimensionKey": this.props.key, entryKeys: entryKey }, {
            $pull: { entryKeys: entryKey },
        });
    }
    async addEntryToBucket(entry, bucketIdentifier) {
        if (bucketIdentifier.dimensionKey !== this.props.key) {
            throw new Error(`Received a bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`);
        }
        let bucket = (await this.toOptionalBucketGivenKey(bucketIdentifier.bucketKey));
        if (bucket == null) {
            bucket = new MaterializedBucket_1.MaterializedBucket({
                identifier: bucketIdentifier,
                db: this.db,
            });
        }
        await bucket.addEntryKey(entry.key);
    }
    async rebuildEntry(entry) {
        await this.deleteEntryKey(entry.key);
        const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);
        if (Array.isArray(bucketIdentifiers)) {
            for (const bucketIdentifier of bucketIdentifiers) {
                if (bucketIdentifier != null) {
                    await this.addEntryToBucket(entry, bucketIdentifier);
                }
            }
        }
        else if (bucketIdentifiers != null) {
            // not an array, just a single object
            await this.addEntryToBucket(entry, bucketIdentifiers);
        }
    }
}
exports.MaterializedDimension = MaterializedDimension;
//# sourceMappingURL=index.js.map