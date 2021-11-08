"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const LiveBucket_1 = require("../../../Dimension/LiveDimension/LiveBucket");
class SelectDimension extends skytree_1.PropsObject {
    get key() {
        return this.props.property.definition.key;
    }
    get label() {
        return this.props.property.definition.label;
    }
    async init(db, stopwatch) {
        this._db = db;
        this._stopwatch = stopwatch;
    }
    async toOptionalBucketGivenKey(bucketKey, bucketLabel) {
        const identifier = {
            dimensionKey: this.key,
            bucketKey,
            bucketLabel: bucketLabel !== null && bucketLabel !== void 0 ? bucketLabel : bucketKey,
        };
        const fullPropertyValuePath = util_1.ValuePath.givenParts([
            "propertyValues",
            this.props.property.definition.key,
            bucketKey
        ]).toString();
        return new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter: {
                [fullPropertyValuePath]: 1,
            },
        });
    }
    async deleteBucketKey(bucketKey) {
        const fullPropertyValuePath = util_1.ValuePath.givenParts([
            "propertyValues",
            this.props.property.definition.key,
            bucketKey
        ]).toString();
        await this._db.collection("entries").updateMany({
            [fullPropertyValuePath]: 1
        }, {
            $unset: {
                [fullPropertyValuePath]: 1
            }
        });
    }
    async toBucketIdentifiers() {
        return this.props.property.definition.options.map((option) => {
            return {
                dimensionKey: this.key,
                bucketKey: option.key,
                bucketLabel: option.label,
            };
        });
    }
    async toBuckets() {
        const bucketIdentifiers = await this.toBucketIdentifiers();
        const result = [];
        const timer2 = this._stopwatch.start("spd-toBuckets-loop");
        for (const identifier of bucketIdentifiers) {
            const bucket = await this.toOptionalBucketGivenKey(identifier.bucketKey, identifier.bucketLabel);
            result.push(bucket);
        }
        timer2.stop();
        return result;
    }
    async deleteEntryKey(entryKey) {
        // empty
    }
    async rebuildEntry(entry) {
        // empty
    }
}
exports.SelectDimension = SelectDimension;
//# sourceMappingURL=index.js.map