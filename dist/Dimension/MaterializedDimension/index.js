"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
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
exports.MaterializedDimension = void 0;
const skytree_1 = require("skytree");
const __1 = require("../..");
const Metric_1 = require("../../Metric");
const MaterializedBucket_1 = require("./MaterializedBucket");
class MaterializedDimension extends skytree_1.PropsObject {
    get key() {
        return this.props.key;
    }
    get label() {
        return this.props.label;
    }
    async init(db) {
        this._db = db;
        await this._db.collection("buckets").createIndex({ entryKeys: 1 });
    }
    async toOptionalBucketGivenKey(bucketKey, bucketLabel) {
        const metric = new Metric_1.Metric("MaterializedDimension.toOptionalBucketGivenKey");
        const find = {
            "identifier.dimensionKey": this.props.key,
            "identifier.bucketKey": bucketKey,
        };
        const bucketRow = await this._db.collection("buckets").findOne(find);
        if (bucketRow == null) {
            return new __1.MetricResult(metric, undefined);
        }
        const result = new MaterializedBucket_1.MaterializedBucket({
            identifier: Object.assign(Object.assign({}, bucketRow.identifier), { bucketLabel: bucketLabel !== null && bucketLabel !== void 0 ? bucketLabel : bucketRow.identifier.bucketLabel }),
            db: this._db,
        });
        return new __1.MetricResult(metric, result);
    }
    toBuckets() {
        return __asyncGenerator(this, arguments, function* toBuckets_1() {
            var e_1, _a;
            const bucketRows = this._db
                .collection("buckets")
                .find({ "identifier.dimensionKey": this.props.key });
            try {
                for (var bucketRows_1 = __asyncValues(bucketRows), bucketRows_1_1; bucketRows_1_1 = yield __await(bucketRows_1.next()), !bucketRows_1_1.done;) {
                    const row = bucketRows_1_1.value;
                    yield yield __await(new MaterializedBucket_1.MaterializedBucket({
                        identifier: row.identifier,
                        db: this._db,
                    }));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (bucketRows_1_1 && !bucketRows_1_1.done && (_a = bucketRows_1.return)) yield __await(_a.call(bucketRows_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    async deleteEntryKey(entryKey) {
        const metric = new Metric_1.Metric("MaterializedDimension.deleteEntryKey");
        await this._db.collection("buckets").updateMany({
            "identifier.dimensionKey": this.props.key,
            entryKeys: entryKey,
        }, {
            $pull: { entryKeys: entryKey },
        });
        return new __1.MetricResult(metric, undefined);
    }
    async addEntryToBucket(entry, bucketIdentifier) {
        if (bucketIdentifier.dimensionKey !== this.props.key) {
            throw new Error(`Received a bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`);
        }
        const metric = new Metric_1.Metric("MaterializedDimension.addEntryToBucket");
        const bucketResult = await this.toOptionalBucketGivenKey(bucketIdentifier.bucketKey, bucketIdentifier.bucketLabel);
        metric.addChildMetric(bucketResult.metric);
        let bucket = bucketResult.value;
        if (bucket == null) {
            bucket = new MaterializedBucket_1.MaterializedBucket({
                identifier: bucketIdentifier,
                db: this._db,
            });
        }
        const addResult = await bucket.addEntryKey(entry.key);
        metric.addChildMetric(addResult.metric);
        return new __1.MetricResult(metric, undefined);
    }
    async rebuildEntry(entry) {
        const metric = new Metric_1.Metric("MaterializedDimension.rebuildEntry");
        const deleteResult = await this.deleteEntryKey(entry.key);
        metric.addChildMetric(deleteResult.metric);
        const bucketIdentifiers = this.props.bucketIdentifiersGivenEntry(entry);
        if (Array.isArray(bucketIdentifiers)) {
            for (const bucketIdentifier of bucketIdentifiers) {
                if (bucketIdentifier != null) {
                    const addResult = await this.addEntryToBucket(entry, bucketIdentifier);
                    metric.addChildMetric(addResult.metric);
                }
            }
        }
        else if (bucketIdentifiers != null) {
            // not an array, just a single object
            const addResult = await this.addEntryToBucket(entry, bucketIdentifiers);
            metric.addChildMetric(addResult.metric);
        }
        return new __1.MetricResult(metric, undefined);
    }
}
exports.MaterializedDimension = MaterializedDimension;
//# sourceMappingURL=index.js.map