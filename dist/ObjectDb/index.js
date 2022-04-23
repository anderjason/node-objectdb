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
exports.ObjectDb = exports.optionalFirstGivenAsyncIterable = exports.countGivenAsyncIterable = exports.arrayGivenAsyncIterable = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const async_mutex_1 = require("async-mutex");
const skytree_1 = require("skytree");
const Dimension_1 = require("../Dimension");
const Entry_1 = require("../Entry");
const Property_1 = require("../Property");
const SelectProperty_1 = require("../Property/Select/SelectProperty");
const SlowResult_1 = require("../SlowResult");
async function arrayGivenAsyncIterable(asyncIterable) {
    var e_1, _a;
    const result = [];
    try {
        for (var asyncIterable_1 = __asyncValues(asyncIterable), asyncIterable_1_1; asyncIterable_1_1 = await asyncIterable_1.next(), !asyncIterable_1_1.done;) {
            const item = asyncIterable_1_1.value;
            result.push(item);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return)) await _a.call(asyncIterable_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return result;
}
exports.arrayGivenAsyncIterable = arrayGivenAsyncIterable;
async function countGivenAsyncIterable(asyncIterable) {
    var e_2, _a;
    let result = 0;
    try {
        for (var asyncIterable_2 = __asyncValues(asyncIterable), asyncIterable_2_1; asyncIterable_2_1 = await asyncIterable_2.next(), !asyncIterable_2_1.done;) {
            const item = asyncIterable_2_1.value;
            result += 1;
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (asyncIterable_2_1 && !asyncIterable_2_1.done && (_a = asyncIterable_2.return)) await _a.call(asyncIterable_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return result;
}
exports.countGivenAsyncIterable = countGivenAsyncIterable;
async function optionalFirstGivenAsyncIterable(asyncIterable) {
    const iterator = asyncIterable[Symbol.asyncIterator]();
    const r = await iterator.next();
    return r.value;
}
exports.optionalFirstGivenAsyncIterable = optionalFirstGivenAsyncIterable;
class ObjectDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this.collectionDidChange = new observable_1.TypedEvent();
        this.entryWillChange = new observable_1.TypedEvent();
        this.entryDidChange = new observable_1.TypedEvent();
        this._isLoaded = observable_1.Observable.givenValue(false, observable_1.Observable.isStrictEqual);
        this.isLoaded = observable_1.ReadOnlyObservable.givenObservable(this._isLoaded);
        this.stopwatch = new time_1.Stopwatch(this.props.label);
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
                await dimension.init(this._db, this.stopwatch);
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
        // console.log(`Waiting for ObjectDB idle in ${this.props.label}...`);
        await this._isLoaded.toPromise((v) => v);
        // console.log(`ObjectDb is idle in ${this.props.label}`);
    }
    async runExclusive(entryKey, fn) {
        if (entryKey == null) {
            throw new Error("entryKey is required");
        }
        if (fn == null) {
            throw new Error("fn is required");
        }
        if (!this._mutexByEntryKey.has(entryKey)) {
            this._mutexByEntryKey.set(entryKey, new async_mutex_1.Mutex());
        }
        const mutex = this._mutexByEntryKey.get(entryKey);
        let result;
        try {
            await mutex.runExclusive(async () => {
                result = await fn();
            });
        }
        finally {
            if (mutex.isLocked() == false) {
                this._mutexByEntryKey.delete(entryKey);
            }
        }
        return result;
    }
    async updateEntryKey(entryKey, partialData) {
        if (entryKey == null) {
            throw new Error("entryKey is required");
        }
        if (partialData == null) {
            throw new Error("partialData is required");
        }
        if (Object.keys(partialData).length === 0) {
            return;
        }
        return this.runExclusive(entryKey, async () => {
            const entry = await this.toEntryGivenKey(entryKey);
            if (entry == null) {
                throw new Error("Entry not found in updateEntryKey");
            }
            Object.assign(entry.data, partialData);
            entry.status = "updated";
            await this.writeEntry(entry);
            return entry;
        });
    }
    allEntryKeys() {
        return __asyncGenerator(this, arguments, function* allEntryKeys_1() {
            var e_3, _a;
            const entries = this._db.collection("entries").find({}, {
                projection: { key: 1 },
            });
            try {
                for (var entries_1 = __asyncValues(entries), entries_1_1; entries_1_1 = yield __await(entries_1.next()), !entries_1_1.done;) {
                    const document = entries_1_1.value;
                    yield yield __await(document.key);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) yield __await(_a.call(entries_1));
                }
                finally { if (e_3) throw e_3.error; }
            }
        });
    }
    toEntryKeys(options = {}) {
        var _a;
        return __asyncGenerator(this, arguments, function* toEntryKeys_1() {
            const now = time_1.Instant.ofNow();
            let entryKeys = undefined;
            yield __await(this.ensureIdle());
            let fullCacheKey = undefined;
            if (options.cacheKey != null) {
                const bucketIdentifiers = (_a = options.filter) !== null && _a !== void 0 ? _a : [];
                const buckets = [];
                for (const bucketIdentifier of bucketIdentifiers) {
                    const bucket = yield __await(this.toOptionalBucketGivenIdentifier(bucketIdentifier));
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
                    entryKeys = yield __await(arrayGivenAsyncIterable(this.allEntryKeys()));
                }
                else {
                    const sets = [];
                    for (const bucketIdentifier of options.filter) {
                        const bucket = yield __await(this.toOptionalBucketGivenIdentifier(bucketIdentifier));
                        if (bucket == null) {
                            sets.push(new Set());
                        }
                        else {
                            const entryKeys = yield __await(bucket.toEntryKeys());
                            sets.push(entryKeys);
                        }
                    }
                    entryKeys = Array.from(util_1.SetUtil.intersectionGivenSets(sets));
                }
                if (options.shuffle == true) {
                    entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (e) => Math.random(), "ascending");
                }
            }
            if (options.cacheKey != null && !this._caches.has(fullCacheKey)) {
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
            for (const i of result) {
                yield yield __await(i);
            }
        });
    }
    // TC: O(N)
    async forEach(fn) {
        var e_4, _a;
        const entryKeys = this.allEntryKeys();
        try {
            for (var entryKeys_1 = __asyncValues(entryKeys), entryKeys_1_1; entryKeys_1_1 = await entryKeys_1.next(), !entryKeys_1_1.done;) {
                const entryKey = entryKeys_1_1.value;
                const entry = await this.toOptionalEntryGivenKey(entryKey);
                await fn(entry);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (entryKeys_1_1 && !entryKeys_1_1.done && (_a = entryKeys_1.return)) await _a.call(entryKeys_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
    }
    async hasEntry(entryKey) {
        const keys = await arrayGivenAsyncIterable(this.toEntryKeys());
        return keys.includes(entryKey);
    }
    async toEntryCount(filter, cacheKey) {
        return countGivenAsyncIterable(this.toEntryKeys({
            filter,
            cacheKey
        }));
    }
    toEntries(options = {}) {
        return __asyncGenerator(this, arguments, function* toEntries_1() {
            var e_5, _a;
            try {
                for (var _b = __asyncValues(this.toEntryKeys(options)), _c; _c = yield __await(_b.next()), !_c.done;) {
                    const entryKey = _c.value;
                    const entry = yield __await(this.toOptionalEntryGivenKey(entryKey));
                    if (entry != null) {
                        yield yield __await(entry);
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                }
                finally { if (e_5) throw e_5.error; }
            }
        });
    }
    async toOptionalFirstEntry(options = {}) {
        return optionalFirstGivenAsyncIterable(this.toEntries(Object.assign(Object.assign({}, options), { limit: 1 })));
    }
    async toEntryGivenKey(entryKey) {
        const result = await this.toOptionalEntryGivenKey(entryKey);
        if (result == null) {
            throw new Error(`Entry not found for key '${entryKey}'`);
        }
        return result;
    }
    async toOptionalEntryGivenKey(entryKey) {
        if (entryKey == null) {
            throw new Error("Entry key is required");
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const result = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
            objectDb: this,
        });
        const didLoad = await result.load();
        if (!didLoad) {
            return undefined;
        }
        return result;
    }
    async toDimensions() {
        const result = [...this._dimensions];
        for (const property of this._propertyByKey.values()) {
            const propertyDimensions = await property.toDimensions();
            propertyDimensions.forEach((dimension) => {
                result.push(dimension);
            });
        }
        for (const dimension of result) {
            await dimension.init(this._db, this.stopwatch);
        }
        return result;
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
        const timer = this.stopwatch.start("rebuildMetadataGivenEntry");
        const dimensions = await this.toDimensions();
        await Promise.all(dimensions.map((dimension) => dimension.rebuildEntry(entry)));
        timer.stop();
    }
    rebuildMetadata() {
        console.log(`Rebuilding metadata for ${this.props.label}...`);
        return new SlowResult_1.SlowResult({
            getItems: () => this.allEntryKeys(),
            getTotalCount: () => this.toEntryCount(),
            fn: async (entryKey) => {
                const entry = await this.toOptionalEntryGivenKey(entryKey);
                if (entry == null) {
                    return;
                }
                await this.rebuildMetadataGivenEntry(entry);
            },
        });
    }
    toBuckets() {
        return __asyncGenerator(this, arguments, function* toBuckets_1() {
            var e_6, _a, e_7, _b;
            const dimensions = yield __await(this.toDimensions());
            try {
                for (var dimensions_1 = __asyncValues(dimensions), dimensions_1_1; dimensions_1_1 = yield __await(dimensions_1.next()), !dimensions_1_1.done;) {
                    const dimension = dimensions_1_1.value;
                    try {
                        for (var _c = (e_7 = void 0, __asyncValues(dimension.toBuckets())), _d; _d = yield __await(_c.next()), !_d.done;) {
                            const bucket = _d.value;
                            yield yield __await(bucket);
                        }
                    }
                    catch (e_7_1) { e_7 = { error: e_7_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) yield __await(_b.call(_c));
                        }
                        finally { if (e_7) throw e_7.error; }
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (dimensions_1_1 && !dimensions_1_1.done && (_a = dimensions_1.return)) yield __await(_a.call(dimensions_1));
                }
                finally { if (e_6) throw e_6.error; }
            }
        });
    }
    toBucketsGivenEntryKey(entryKey) {
        return new SlowResult_1.SlowResult({
            getItems: () => this.toBuckets(),
            fn: async (bucket) => {
                const hasItem = await bucket.hasEntryKey(entryKey);
                return hasItem ? bucket.identifier : undefined;
            },
        });
    }
    async toOptionalDimensionGivenKey(dimensionKey) {
        if (dimensionKey == null) {
            return undefined;
        }
        const dimensions = await this.toDimensions();
        return dimensions.find((d) => d.key === dimensionKey);
    }
    async toOptionalBucketGivenIdentifier(bucketIdentifier) {
        const dimension = await this.toOptionalDimensionGivenKey(bucketIdentifier.dimensionKey);
        if (dimension == null) {
            return undefined;
        }
        return dimension.toOptionalBucketGivenKey(bucketIdentifier.bucketKey, bucketIdentifier.bucketLabel);
    }
    async writeEntry(entry) {
        if (entry == null) {
            throw new Error("Entry is required");
        }
        switch (entry.status) {
            case "deleted":
                await this.deleteEntryKey(entry.key);
                break;
            case "new":
            case "saved":
            case "updated":
            case "unknown":
                if ("createdAt" in entry) {
                    await this.writeEntryData(entry.data, entry.propertyValues, entry.key, entry.createdAt, entry.documentVersion);
                }
                else {
                    const createdAt = entry.createdAtEpochMs != null
                        ? time_1.Instant.givenEpochMilliseconds(entry.createdAtEpochMs)
                        : undefined;
                    await this.writeEntryData(entry.data, entry.propertyValues, entry.key, createdAt, entry.documentVersion);
                }
                break;
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
        let entry = await this.toOptionalEntryGivenKey(entryKey);
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
            return;
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
        await entry.save();
        await this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(change);
        await this.ensureIdle();
        return entry;
    }
    async deleteEntryKey(entryKey) {
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const existingRecord = await this.toOptionalEntryGivenKey(entryKey);
        if (existingRecord == null) {
            return;
        }
        const change = {
            key: entryKey,
            entry: existingRecord,
            oldData: existingRecord.data,
        };
        this.entryWillChange.emit(change);
        const dimensions = await this.toDimensions();
        for (const dimension of dimensions) {
            await dimension.deleteEntryKey(entryKey);
        }
        await this._db.collection("entries").deleteOne({ key: entryKey });
        this.entryDidChange.emit(change);
        this.collectionDidChange.emit();
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map