"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedDimension = void 0;
const skytree_1 = require("skytree");
const MaterializedBucket_1 = require("./MaterializedBucket");
class MaterializedDimension extends skytree_1.PropsObject {
    get key() {
        return this.props.key;
    }
    get label() {
        return this.props.label;
    }
    async init(db, stopwatch) {
        this._db = db;
        this._stopwatch = stopwatch;
        await this._db.collection("buckets").createIndex({ entryKeys: 1 });
    }
    async toOptionalBucketGivenKey(bucketKey) {
        const find = {
            "identifier.dimensionKey": this.props.key,
            "identifier.bucketKey": bucketKey,
        };
        const timer = this._stopwatch.start("md-toOptionalBucketGivenKey");
        const bucketRow = await this._db.collection("buckets").findOne(find);
        timer.stop();
        if (bucketRow == null) {
            return undefined;
        }
        return new MaterializedBucket_1.MaterializedBucket({
            identifier: bucketRow.identifier,
            db: this._db,
        });
    }
    async toBuckets() {
        const timer = this._stopwatch.start("md-toBuckets");
        const bucketRows = await this._db
            .collection("buckets")
            .find({ "identifier.dimensionKey": this.props.key })
            .toArray();
        timer.stop();
        const result = [];
        const timer2 = this._stopwatch.start("md-toBuckets-loop");
        for (const row of bucketRows) {
            result.push(new MaterializedBucket_1.MaterializedBucket({
                identifier: row.identifier,
                db: this._db,
            }));
        }
        timer2.stop();
        return result;
    }
    async deleteEntryKey(entryKey) {
        const timer = this._stopwatch.start("md-deleteEntryKey");
        await this._db.collection("buckets").updateMany({ "identifier.dimensionKey": this.props.key, entryKeys: entryKey }, {
            $pull: { entryKeys: entryKey },
        });
        timer.stop();
    }
    async addEntryToBucket(entry, bucketIdentifier) {
        if (bucketIdentifier.dimensionKey !== this.props.key) {
            throw new Error(`Received a bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`);
        }
        const timer = this._stopwatch.start("md-addEntryToBucket");
        let bucket = (await this.toOptionalBucketGivenKey(bucketIdentifier.bucketKey));
        if (bucket == null) {
            bucket = new MaterializedBucket_1.MaterializedBucket({
                identifier: bucketIdentifier,
                db: this._db,
            });
        }
        await bucket.addEntryKey(entry.key);
        timer.stop();
    }
    async rebuildEntry(entry) {
        const timer = this._stopwatch.start("md-rebuildEntry");
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
        timer.stop();
    }
}
exports.MaterializedDimension = MaterializedDimension;
//# sourceMappingURL=index.js.map