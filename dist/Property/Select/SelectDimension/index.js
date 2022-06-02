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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const __1 = require("../../..");
const LiveBucket_1 = require("../../../Dimension/LiveDimension/LiveBucket");
class SelectDimension extends skytree_1.PropsObject {
    get key() {
        return this.props.property.definition.key;
    }
    get label() {
        return this.props.property.definition.label;
    }
    async init(db) {
        this._db = db;
    }
    async toOptionalBucketGivenKey(bucketKey, bucketLabel) {
        const metric = new __1.Metric("SelectDimension.toOptionalBucketGivenKey");
        const identifier = {
            dimensionKey: this.key,
            bucketKey,
            bucketLabel: bucketLabel !== null && bucketLabel !== void 0 ? bucketLabel : bucketKey,
        };
        const fullPropertyValuePath = util_1.ValuePath.givenParts([
            "propertyValues",
            this.props.property.definition.key,
            bucketKey,
        ]).toString();
        const result = new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter: {
                [fullPropertyValuePath]: 1,
            },
        });
        return new __1.MetricResult(metric, result);
    }
    async deleteBucketKey(bucketKey) {
        const metric = new __1.Metric("SelectDimension.deleteBucketKey");
        const fullPropertyValuePath = util_1.ValuePath.givenParts([
            "propertyValues",
            this.props.property.definition.key,
            bucketKey,
        ]).toString();
        await this._db.collection("entries").updateMany({
            [fullPropertyValuePath]: 1,
        }, {
            $unset: {
                [fullPropertyValuePath]: 1,
            },
        });
        return new __1.MetricResult(metric, undefined);
    }
    toBucketIdentifiers() {
        return __asyncGenerator(this, arguments, function* toBucketIdentifiers_1() {
            for (const option of this.props.property.definition.options) {
                yield yield __await({
                    dimensionKey: this.key,
                    bucketKey: option.key,
                    bucketLabel: option.label,
                });
            }
        });
    }
    toBuckets() {
        return __asyncGenerator(this, arguments, function* toBuckets_1() {
            var e_1, _a;
            try {
                for (var _b = __asyncValues(this.toBucketIdentifiers()), _c; _c = yield __await(_b.next()), !_c.done;) {
                    const identifier = _c.value;
                    const bucketResult = yield __await(this.toOptionalBucketGivenKey(identifier.bucketKey, identifier.bucketLabel));
                    const bucket = bucketResult.value;
                    if (bucket != null) {
                        yield yield __await(bucket);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                }
                finally { if (e_1) throw e_1.error; }
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
exports.SelectDimension = SelectDimension;
//# sourceMappingURL=index.js.map