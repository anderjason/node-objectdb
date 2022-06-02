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
exports.LiveDimension = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const __1 = require("../..");
const Metric_1 = require("../../Metric");
const LiveBucket_1 = require("./LiveBucket");
class LiveDimension extends skytree_1.PropsObject {
    static ofEntry(params) {
        const fullPropertyName = params.valuePath.toParts().join(".");
        return new LiveDimension({
            key: params.dimensionKey,
            label: params.dimensionLabel,
            allBucketIdentifiers: async (db) => {
                if (params.valueType === "single") {
                    const entries = await db
                        .collection("entries")
                        .find({
                        [fullPropertyName]: { $exists: true },
                    }, { projection: { _id: 0, [fullPropertyName]: 1 } })
                        .toArray();
                    const values = entries.map((e) => {
                        return util_1.ObjectUtil.optionalValueAtPathGivenObject(e, params.valuePath);
                    });
                    const uniqueValues = Array.from(new Set(values));
                    uniqueValues.sort();
                    return uniqueValues.map((value) => {
                        const key = String(value);
                        const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;
                        return {
                            dimensionKey: params.dimensionKey,
                            bucketKey: key,
                            bucketLabel: label,
                        };
                    });
                }
                else if (params.valueType === "array") {
                    const aggregateResult = await db
                        .collection("entries")
                        .aggregate([
                        {
                            $match: {
                                [fullPropertyName]: { $exists: true },
                            },
                        },
                        { $project: { a: "$" + fullPropertyName } },
                        { $unwind: "$a" },
                        { $group: { _id: "a", res: { $addToSet: "$a" } } },
                    ])
                        .toArray();
                    const row = aggregateResult[0];
                    const allValues = row == null ? [] : Array.from(new Set(row.res));
                    allValues.sort();
                    return allValues.map((value) => {
                        const key = String(value);
                        const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;
                        return {
                            dimensionKey: params.dimensionKey,
                            bucketKey: key,
                            bucketLabel: label,
                        };
                    });
                }
            },
            mongoFilterGivenBucketIdentifier: (bucketIdentifier) => {
                const key = bucketIdentifier.bucketKey;
                const value = params.mongoValueGivenBucketKey != null
                    ? params.mongoValueGivenBucketKey(key)
                    : key;
                return {
                    [fullPropertyName]: value,
                };
            },
        });
    }
    get key() {
        return this.props.key;
    }
    get label() {
        return this.props.label;
    }
    async init(db) {
        this._db = db;
    }
    async toOptionalBucketGivenKey(bucketKey, bucketLabel) {
        const metric = new Metric_1.Metric("LiveDimension.toOptionalBucketGivenKey");
        const identifier = {
            dimensionKey: this.key,
            bucketKey,
            bucketLabel: bucketLabel !== null && bucketLabel !== void 0 ? bucketLabel : bucketKey,
        };
        const result = new LiveBucket_1.LiveBucket({
            identifier,
            db: this._db,
            mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
        });
        return new __1.MetricResult(metric, result);
    }
    toBucketIdentifiers() {
        return __asyncGenerator(this, arguments, function* toBucketIdentifiers_1() {
            // TODO optimize
            const bucketIdentifiers = yield __await(this.props.allBucketIdentifiers(this._db));
            for (const identifier of bucketIdentifiers) {
                yield yield __await(identifier);
            }
        });
    }
    toBuckets() {
        return __asyncGenerator(this, arguments, function* toBuckets_1() {
            var e_1, _a;
            try {
                for (var _b = __asyncValues(this.toBucketIdentifiers()), _c; _c = yield __await(_b.next()), !_c.done;) {
                    const identifier = _c.value;
                    yield yield __await(new LiveBucket_1.LiveBucket({
                        identifier,
                        db: this._db,
                        mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
                    }));
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
exports.LiveDimension = LiveDimension;
//# sourceMappingURL=index.js.map