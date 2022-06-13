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
exports.ObjectDb = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const async_mutex_1 = require("async-mutex");
const skytree_1 = require("skytree");
const Dimension_1 = require("../Dimension");
const Entry_1 = require("../Entry");
const Metric_1 = require("../Metric");
const Property_1 = require("../Property");
const SelectProperty_1 = require("../Property/Select/SelectProperty");
const SlowResult_1 = require("../SlowResult");
class ObjectDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this.collectionDidChange = new observable_1.TypedEvent();
        this.entryWillChange = new observable_1.TypedEvent();
        this.entryDidChange = new observable_1.TypedEvent();
        this._isLoaded = observable_1.Observable.givenValue(false, observable_1.Observable.isStrictEqual);
        this.isLoaded = observable_1.ReadOnlyObservable.givenObservable(this._isLoaded);
        this._dimensions = [];
        this._propertyByKey = new Map();
        this._caches = new Map();
        this._mutexByEntryKey = new Map();
    }
    get mongoDb() {
        return this._db;
    }
    onActivate() {
        this._db = this.props.db;
        this.load();
    }
    async load() {
        if (this.isActive == false) {
            return;
        }
        await this._db.isConnected.toPromise((v) => v);
        if (this.props.dimensions != null) {
            for (const dimension of this.props.dimensions) {
                await dimension.init(this._db);
                this._dimensions.push(dimension);
            }
        }
        const propertyDefinitions = await this._db
            .collection("properties")
            .find({}, {
            projection: { _id: 0 },
        })
            .toArray();
        for (const propertyDefinition of propertyDefinitions) {
            const property = (0, Property_1.propertyGivenDefinition)(propertyDefinition);
            this._propertyByKey.set(propertyDefinition.key, property);
        }
        this._isLoaded.setValue(true);
    }
    async ensureIdle() {
        const metric = new Metric_1.Metric("ensureIdle");
        await this._isLoaded.toPromise((v) => v);
        return new Metric_1.MetricResult(metric, undefined);
    }
    async runExclusive(entryKey, fn) {
        if (entryKey == null) {
            throw new Error("entryKey is required");
        }
        if (fn == null) {
            throw new Error("fn is required");
        }
        const metric = new Metric_1.Metric("runExclusive");
        if (!this._mutexByEntryKey.has(entryKey)) {
            this._mutexByEntryKey.set(entryKey, new async_mutex_1.Mutex());
        }
        const mutex = this._mutexByEntryKey.get(entryKey);
        try {
            return mutex.runExclusive(async () => {
                const fnResult = await fn();
                metric.addChildMetric(fnResult.metric);
                const result = fnResult.value;
                return new Metric_1.MetricResult(metric, result);
            });
        }
        finally {
            if (mutex.isLocked() == false) {
                this._mutexByEntryKey.delete(entryKey);
            }
        }
    }
    async updateEntryKey(entryKey, partialData) {
        if (entryKey == null) {
            throw new Error("entryKey is required");
        }
        if (partialData == null) {
            throw new Error("partialData is required");
        }
        return this.runExclusive(entryKey, async () => {
            const metric = new Metric_1.Metric("updateEntryKey");
            const entryResult = await this.toEntryGivenKey(entryKey);
            if (entryResult.value == null) {
                throw new Error("Entry not found in updateEntryKey");
            }
            const entry = entryResult.value;
            metric.addChildMetric(entryResult.metric);
            Object.assign(entry.data, partialData);
            entry.status = "updated";
            const writeResult = await this.writeEntry(entry);
            metric.addChildMetric(writeResult.metric);
            return new Metric_1.MetricResult(metric, entry);
        });
    }
    async allEntryKeys() {
        const metric = new Metric_1.Metric("allEntryKeys");
        const collection = this._db.collection("entries");
        const entries = collection.find({}, {
            projection: { key: 1 },
        });
        function inner() {
            return __asyncGenerator(this, arguments, function* inner_1() {
                var e_1, _a;
                try {
                    for (var entries_1 = __asyncValues(entries), entries_1_1; entries_1_1 = yield __await(entries_1.next()), !entries_1_1.done;) {
                        const document = entries_1_1.value;
                        yield yield __await(document.key);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) yield __await(_a.call(entries_1));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                yield __await(entries.close());
            });
        }
        return new Metric_1.MetricResult(metric, inner());
    }
    async toEntryKeys(options = {}) {
        var _a;
        const metric = new Metric_1.Metric("toEntryKeys");
        let entryKeys = undefined;
        const ensureIdleResult = await this.ensureIdle();
        metric.addChildMetric(ensureIdleResult.metric);
        let fullCacheKey = undefined;
        if (options.cacheKey != null) {
            const bucketIdentifiers = (_a = options.filter) !== null && _a !== void 0 ? _a : [];
            const buckets = [];
            for (const bucketIdentifier of bucketIdentifiers) {
                const bucketResult = await this.toOptionalBucketGivenIdentifier(bucketIdentifier);
                const bucket = bucketResult.value;
                metric.addChildMetric(bucketResult.metric);
                if (bucket != null) {
                    buckets.push(bucket);
                }
            }
            const hashCodes = buckets.map((bucket) => (0, Dimension_1.hashCodeGivenBucketIdentifier)(bucket.identifier));
            const cacheKeyData = `${options.cacheKey}:${hashCodes.join(",")}`;
            fullCacheKey = util_1.StringUtil.hashCodeGivenString(cacheKeyData);
        }
        if (fullCacheKey != null) {
            const cacheData = this._caches.get(fullCacheKey);
            if (cacheData != null) {
                entryKeys = cacheData.entryKeys;
            }
        }
        if (entryKeys == null) {
            if (util_1.ArrayUtil.arrayIsEmptyOrNull(options.filter)) {
                const entryKeysResult = await this.allEntryKeys();
                metric.addChildMetric(entryKeysResult.metric);
                entryKeys = await util_1.IterableUtil.arrayGivenAsyncIterable(entryKeysResult.value);
            }
            else {
                const sets = [];
                for (const bucketIdentifier of options.filter) {
                    const bucketResult = await this.toOptionalBucketGivenIdentifier(bucketIdentifier);
                    const bucket = bucketResult.value;
                    if (bucket == null) {
                        sets.push(new Set());
                    }
                    else {
                        const entryKeysResult = await bucket.toEntryKeys();
                        const entryKeys = entryKeysResult.value;
                        sets.push(entryKeys);
                    }
                }
                entryKeys = Array.from(util_1.SetUtil.intersectionGivenSets(sets));
            }
            if (options.shuffle == true) {
                entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (e) => Math.random(), "ascending");
            }
        }
        if (options.cacheKey != null &&
            fullCacheKey != null &&
            !this._caches.has(fullCacheKey)) {
            this._caches.set(fullCacheKey, {
                entryKeys,
            });
        }
        let start = 0;
        let end = entryKeys.length;
        if (options.offset != null) {
            start = parseInt(options.offset, 10);
        }
        if (options.limit != null) {
            end = Math.min(end, start + parseInt(options.limit, 10));
        }
        const result = entryKeys.slice(start, end);
        function inner() {
            return __asyncGenerator(this, arguments, function* inner_2() {
                for (const i of result) {
                    yield yield __await(i);
                }
            });
        }
        return new Metric_1.MetricResult(metric, inner());
    }
    // TC: O(N)
    async forEach(fn) {
        var e_2, _a;
        const entryKeysResult = await this.allEntryKeys();
        try {
            for (var _b = __asyncValues(entryKeysResult.value), _c; _c = await _b.next(), !_c.done;) {
                const entryKey = _c.value;
                const entryResult = await this.toOptionalEntryGivenKey(entryKey);
                const entry = entryResult.value;
                if (entry != null) {
                    await fn(entry);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    async hasEntry(entryKey) {
        const metric = new Metric_1.Metric("hasEntry");
        const entryKeysResult = await this.toEntryKeys();
        metric.addChildMetric(entryKeysResult.metric);
        const keys = await util_1.IterableUtil.arrayGivenAsyncIterable(entryKeysResult.value);
        const value = keys.includes(entryKey);
        return new Metric_1.MetricResult(metric, value);
    }
    async toEntryCount(filter, cacheKey) {
        const metric = new Metric_1.Metric("toEntryCount");
        const entryKeysResult = await this.toEntryKeys({
            filter,
            cacheKey,
        });
        metric.addChildMetric(entryKeysResult.metric);
        const value = await util_1.IterableUtil.countGivenAsyncIterable(entryKeysResult.value);
        return new Metric_1.MetricResult(metric, value);
    }
    async toEntries(options = {}) {
        const metric = new Metric_1.Metric("toEntries");
        const entryKeysResult = await this.toEntryKeys(options);
        metric.addChildMetric(metric);
        const self = this;
        function inner() {
            return __asyncGenerator(this, arguments, function* inner_3() {
                var e_3, _a;
                try {
                    for (var _b = __asyncValues(entryKeysResult.value), _c; _c = yield __await(_b.next()), !_c.done;) {
                        const entryKey = _c.value;
                        const entryResult = yield __await(self.toOptionalEntryGivenKey(entryKey));
                        const entry = entryResult.value;
                        metric.addChildMetric(entryResult.metric);
                        if (entry != null) {
                            yield yield __await(entry);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            });
        }
        return new Metric_1.MetricResult(metric, inner());
    }
    async toOptionalFirstEntry(options = {}) {
        const metric = new Metric_1.Metric("toOptionalFirstEntry");
        const entriesResult = await this.toEntries(Object.assign(Object.assign({}, options), { limit: 1 }));
        metric.addChildMetric(entriesResult.metric);
        const result = await util_1.IterableUtil.optionalNthValueGivenAsyncIterable(entriesResult.value, 0);
        return new Metric_1.MetricResult(metric, result);
    }
    async toEntryGivenKey(entryKey) {
        const entryResult = await this.toOptionalEntryGivenKey(entryKey);
        const entry = entryResult.value;
        if (entry == null) {
            throw new Error(`Entry not found for key '${entryKey}'`);
        }
        return new Metric_1.MetricResult(entryResult.metric, entry);
    }
    async toOptionalEntryGivenKey(entryKey) {
        if (entryKey == null) {
            throw new Error("Entry key is required");
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const metric = new Metric_1.Metric("toOptionalEntryGivenKey");
        const result = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
            objectDb: this,
        });
        const didLoadResult = await result.load();
        metric.addChildMetric(didLoadResult.metric);
        if (!didLoadResult.value) {
            return new Metric_1.MetricResult(metric, undefined);
        }
        return new Metric_1.MetricResult(metric, result);
    }
    async toDimensions() {
        const metric = new Metric_1.Metric("toDimensions");
        const result = [...this._dimensions];
        for (const property of this._propertyByKey.values()) {
            const propertyDimensions = await property.toDimensions();
            propertyDimensions.forEach((dimension) => {
                result.push(dimension);
            });
        }
        for (const dimension of result) {
            await dimension.init(this._db);
        }
        return new Metric_1.MetricResult(metric, result);
    }
    async writeProperty(definition) {
        let property;
        switch (definition.propertyType) {
            case "select":
                property = await SelectProperty_1.SelectProperty.writeDefinition(this._db, definition);
                break;
            default:
                throw new Error(`Unsupported property type '${definition.propertyType}'`);
        }
        this._propertyByKey.set(definition.key, property);
    }
    async deletePropertyKey(propertyKey) {
        await this._db.collection("properties").deleteOne({ key: propertyKey });
        const fullPropertyPath = `propertyValues.${propertyKey}`;
        await this.props.db.collection("buckets").updateMany({ [fullPropertyPath]: { $exists: true } }, {
            $unset: { [fullPropertyPath]: 1 },
        });
        this._propertyByKey.delete(propertyKey);
    }
    async toOptionalPropertyGivenKey(key) {
        return this._propertyByKey.get(key);
    }
    async toProperties() {
        return Array.from(this._propertyByKey.values());
    }
    async rebuildMetadataGivenEntry(entry) {
        const metric = new Metric_1.Metric("rebuildMetadataGivenEntry");
        const dimensionsResult = await this.toDimensions();
        metric.addChildMetric(dimensionsResult.metric);
        const metricResults = await Promise.all(dimensionsResult.value.map((dimension) => dimension.rebuildEntry(entry)));
        for (const metricResult of metricResults) {
            metric.addChildMetric(metricResult.metric);
        }
        return new Metric_1.MetricResult(metric, undefined);
    }
    rebuildMetadata() {
        console.log(`Rebuilding metadata for ${this.props.label}...`);
        return new SlowResult_1.SlowResult({
            getItems: async () => {
                const entryKeysResult = await this.allEntryKeys();
                return entryKeysResult.value;
            },
            getTotalCount: async () => {
                const entryCountResult = await this.toEntryCount();
                return entryCountResult.value;
            },
            fn: async (entryKey) => {
                var _a;
                const entryResult = await this.toOptionalEntryGivenKey(entryKey);
                const entry = entryResult.value;
                if (entry != null) {
                    const rebuildResult = await this.rebuildMetadataGivenEntry(entry);
                    console.log(JSON.stringify((_a = rebuildResult.metric) === null || _a === void 0 ? void 0 : _a.toPortableObject(), null, 2));
                }
            },
        });
    }
    async toBuckets() {
        const metric = new Metric_1.Metric("toBuckets");
        const dimensionsResult = await this.toDimensions();
        metric.addChildMetric(dimensionsResult.metric);
        function inner() {
            return __asyncGenerator(this, arguments, function* inner_4() {
                var e_4, _a, e_5, _b;
                try {
                    for (var _c = __asyncValues(dimensionsResult.value), _d; _d = yield __await(_c.next()), !_d.done;) {
                        const dimension = _d.value;
                        try {
                            for (var _e = (e_5 = void 0, __asyncValues(dimension.toBuckets())), _f; _f = yield __await(_e.next()), !_f.done;) {
                                const bucket = _f.value;
                                yield yield __await(bucket);
                            }
                        }
                        catch (e_5_1) { e_5 = { error: e_5_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) yield __await(_b.call(_e));
                            }
                            finally { if (e_5) throw e_5.error; }
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) yield __await(_a.call(_c));
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            });
        }
        return new Metric_1.MetricResult(metric, inner());
    }
    toBucketsGivenEntryKey(entryKey) {
        return new SlowResult_1.SlowResult({
            getItems: async () => {
                const bucketsResult = await this.toBuckets();
                return bucketsResult.value;
            },
            fn: async (bucket) => {
                const hasItemResult = await bucket.hasEntryKey(entryKey);
                const hasItem = hasItemResult.value;
                return hasItem == true ? bucket.identifier : undefined;
            },
        });
    }
    async toOptionalDimensionGivenKey(dimensionKey) {
        const metric = new Metric_1.Metric("dimensionKey");
        if (dimensionKey == null) {
            return new Metric_1.MetricResult(metric, undefined);
        }
        const dimensionsResult = await this.toDimensions();
        metric.addChildMetric(dimensionsResult.metric);
        const result = dimensionsResult.value.find((d) => d.key === dimensionKey);
        return new Metric_1.MetricResult(metric, result);
    }
    async toOptionalBucketGivenIdentifier(bucketIdentifier) {
        const metric = new Metric_1.Metric("toOptionalBucketGivenIdentifier");
        const dimensionResult = await this.toOptionalDimensionGivenKey(bucketIdentifier.dimensionKey);
        metric.addChildMetric(dimensionResult.metric);
        if (dimensionResult.value == null) {
            return new Metric_1.MetricResult(metric, undefined);
        }
        const bucketResult = await dimensionResult.value.toOptionalBucketGivenKey(bucketIdentifier.bucketKey, bucketIdentifier.bucketLabel);
        metric.addChildMetric(bucketResult.metric);
        return new Metric_1.MetricResult(metric, bucketResult.value);
    }
    async writeEntry(entry) {
        if (entry == null) {
            throw new Error("Entry is required");
        }
        switch (entry.status) {
            case "deleted":
                return this.deleteEntryKey(entry.key);
            case "new":
            case "saved":
            case "updated":
            case "unknown":
                if ("createdAt" in entry) {
                    const writeResult = await this.writeEntryData(entry.data, entry.propertyValues, entry.key, entry.createdAt, entry.documentVersion);
                    return new Metric_1.MetricResult(writeResult.metric, undefined);
                }
                else {
                    const createdAtEpochMs = entry.createdAtEpochMs;
                    const createdAt = createdAtEpochMs != null
                        ? time_1.Instant.givenEpochMilliseconds(createdAtEpochMs)
                        : undefined;
                    const writeResult = await this.writeEntryData(entry.data, entry.propertyValues, entry.key, createdAt, entry.documentVersion);
                    return new Metric_1.MetricResult(writeResult.metric, undefined);
                }
            default:
                throw new Error(`Unsupported entry status '${entry.status}'`);
        }
    }
    async writeEntryData(entryData, propertyValues = {}, entryKey, createdAt, documentVersion) {
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const metric = new Metric_1.Metric("writeEntryData");
        const entryResult = await this.toOptionalEntryGivenKey(entryKey);
        let entry = entryResult.value;
        metric.addChildMetric(entryResult.metric);
        const oldDocumentVersion = entry === null || entry === void 0 ? void 0 : entry.documentVersion;
        if (oldDocumentVersion != null &&
            documentVersion != null &&
            oldDocumentVersion !== documentVersion) {
            console.log("key", entryKey);
            console.log("old version", oldDocumentVersion, entry === null || entry === void 0 ? void 0 : entry.data);
            console.log("new version", documentVersion, entryData);
            throw new Error("Document version does not match");
        }
        const oldPortableEntry = entry === null || entry === void 0 ? void 0 : entry.toPortableEntry();
        const oldData = oldPortableEntry === null || oldPortableEntry === void 0 ? void 0 : oldPortableEntry.data;
        const oldPropertyValues = oldPortableEntry === null || oldPortableEntry === void 0 ? void 0 : oldPortableEntry.propertyValues;
        if (util_1.ObjectUtil.objectIsDeepEqual(oldData, entryData) &&
            util_1.ObjectUtil.objectIsDeepEqual(oldPropertyValues, propertyValues)) {
            // nothing changed
            return new Metric_1.MetricResult(metric, entry);
        }
        const now = time_1.Instant.ofNow();
        let didCreateNewEntry = false;
        if (entry == null) {
            entry = new Entry_1.Entry({
                key: entryKey,
                db: this._db,
                createdAt: createdAt || now,
                updatedAt: now,
                objectDb: this,
            });
            didCreateNewEntry = true;
        }
        entry.data = entryData;
        entry.propertyValues = propertyValues;
        const change = {
            key: entryKey,
            entry,
            oldData,
            newData: entryData,
        };
        this.entryWillChange.emit(change);
        const saveResult = await entry.save();
        metric.addChildMetric(saveResult.metric);
        const rebuildResult = await this.rebuildMetadataGivenEntry(entry);
        metric.addChildMetric(rebuildResult.metric);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(change);
        const ensureIdleResult = await this.ensureIdle();
        metric.addChildMetric(ensureIdleResult.metric);
        return new Metric_1.MetricResult(metric, entry);
    }
    async deleteEntryKey(entryKey) {
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const metric = new Metric_1.Metric("deleteEntryKey");
        const existingRecordResult = await this.toOptionalEntryGivenKey(entryKey);
        const existingRecord = existingRecordResult.value;
        metric.addChildMetric(existingRecordResult.metric);
        if (existingRecord == null) {
            return new Metric_1.MetricResult(metric, undefined);
        }
        const change = {
            key: entryKey,
            entry: existingRecord,
            oldData: existingRecord.data,
        };
        this.entryWillChange.emit(change);
        const dimensionsResult = await this.toDimensions();
        metric.addChildMetric(dimensionsResult.metric);
        for (const dimension of dimensionsResult.value) {
            await dimension.deleteEntryKey(entryKey);
        }
        await this._db.collection("entries").deleteOne({ key: entryKey });
        this.entryDidChange.emit(change);
        this.collectionDidChange.emit();
        return new Metric_1.MetricResult(metric, undefined);
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map