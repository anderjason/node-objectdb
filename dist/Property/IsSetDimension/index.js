"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsSetDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const __1 = require("../..");
const LiveBucket_1 = require("../../Dimension/LiveDimension/LiveBucket");
class IsSetDimension extends skytree_1.PropsObject {
    get key() {
        return `${this.props.property.definition.key}-isSet`;
    }
    get label() {
        return `${this.props.property.definition.label} is set`;
    }
    async init(db) {
        this._db = db;
    }
    async toOptionalBucketGivenKey(bucketKey, bucketLabel) {
        const metric = new __1.Metric("IsSetDimension.toOptionalBucketGivenKey");
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
        const result = new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter,
        });
        return new __1.MetricResult(metric, result);
    }
    async deleteBucketKey(bucketKey) {
        // empty
        return new __1.MetricResult(undefined, undefined);
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
    toBuckets() {
        return __asyncGenerator(this, arguments, function* toBuckets_1() {
            // TODO optimize
            const identifiers = yield __await(this.toBucketIdentifiers());
            for (const identifier of identifiers) {
                const bucketResult = yield __await(this.toOptionalBucketGivenKey(identifier.bucketKey, identifier.bucketLabel));
                const bucket = bucketResult.value;
                if (bucket != null) {
                    yield yield __await(bucket);
                }
            }
        });
    }
    async deleteEntryKey(entryKey) {
        // empty
        return new __1.MetricResult(undefined, undefined);
    }
    async rebuildEntry(entry) {
        // empty
        return new __1.MetricResult(undefined, undefined);
    }
}
exports.IsSetDimension = IsSetDimension;
//# sourceMappingURL=index.js.map