"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectPropertyDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const LiveBucket_1 = require("../LiveDimension/LiveBucket");
class SelectPropertyDimension extends skytree_1.PropsObject {
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
    async toOptionalBucketGivenKey(bucketKey) {
        const identifier = {
            dimensionKey: this.key,
            bucketKey,
            bucketLabel: bucketKey,
        };
        const fullPropertyValuePath = util_1.ValuePath.givenParts([
            "propertyValues",
            this.props.property.definition.key,
        ]).toString();
        return new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter: {
                [fullPropertyValuePath]: bucketKey,
            },
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
            const fullPropertyValuePath = util_1.ValuePath.givenParts([
                "propertyValues",
                this.props.property.definition.key,
                identifier.bucketKey,
            ]).toString();
            const mongoFilter = {
                [fullPropertyValuePath]: 1
            };
            result.push(new LiveBucket_1.LiveBucket({
                identifier,
                db: this._db,
                mongoFilter,
            }));
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
exports.SelectPropertyDimension = SelectPropertyDimension;
//# sourceMappingURL=index.js.map