"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsSetDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const LiveBucket_1 = require("../../Dimension/LiveDimension/LiveBucket");
class IsSetDimension extends skytree_1.PropsObject {
    get key() {
        return `${this.props.property.definition.key}-isSet`;
    }
    get label() {
        return `${this.props.property.definition.label} is set`;
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
        ]).toString();
        let mongoFilter;
        if (bucketKey === "true") {
            mongoFilter = {
                [fullPropertyValuePath]: { $exists: true, $ne: {} },
            };
        }
        else {
            mongoFilter = {
                $or: [
                    {
                        [fullPropertyValuePath]: { $exists: false },
                    },
                    {
                        [fullPropertyValuePath]: { $eq: {} },
                    },
                ],
            };
        }
        return new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter,
        });
    }
    async deleteBucketKey(bucketKey) {
        // empty
    }
    async toBucketIdentifiers() {
        return [
            {
                dimensionKey: this.key,
                bucketKey: "true",
                bucketLabel: "true",
            },
            {
                dimensionKey: this.key,
                bucketKey: "false",
                bucketLabel: "false",
            },
        ];
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
exports.IsSetDimension = IsSetDimension;
//# sourceMappingURL=index.js.map