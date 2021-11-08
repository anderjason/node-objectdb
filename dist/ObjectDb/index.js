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
const skytree_1 = require("skytree");
const Dimension_1 = require("../Dimension");
const Entry_1 = require("../Entry");
const Property_1 = require("../Property");
const SelectProperty_1 = require("../Property/Select/SelectProperty");
const SlowResult_1 = require("../SlowResult");
function allEntryKeys(db) {
    return __asyncGenerator(this, arguments, function* allEntryKeys_1() {
        var e_1, _a;
        const entries = db
            .collection("entries")
            .find({}, {
            projection: { key: 1 },
        });
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
    });
}
async function arrayGivenAsyncIterable(asyncIterator) {
    var e_2, _a;
    const result = [];
    try {
        for (var asyncIterator_1 = __asyncValues(asyncIterator), asyncIterator_1_1; asyncIterator_1_1 = await asyncIterator_1.next(), !asyncIterator_1_1.done;) {
            const item = asyncIterator_1_1.value;
            result.push(item);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (asyncIterator_1_1 && !asyncIterator_1_1.done && (_a = asyncIterator_1.return)) await _a.call(asyncIterator_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return result;
}
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
    }
    get mongoDb() {
        return this._db;
    }
    onActivate() {
        this._db = this.props.db;
        this.addActor(new skytree_1.Timer({
            duration: time_1.Duration.givenMinutes(1),
            isRepeating: true,
            fn: () => {
                const nowMs = time_1.Instant.ofNow().toEpochMilliseconds();
                const entries = Array.from(this._caches.entries());
                for (const [key, val] of entries) {
                    if (val.expiresAt.toEpochMilliseconds() < nowMs) {
                        this._caches.delete(key);
                    }
                }
            },
        }));
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
    allEntryKeys() {
        return allEntryKeys(this._db);
    }
    async toEntryKeys(options = {}) {
        var _a;
        const now = time_1.Instant.ofNow();
        let entryKeys = undefined;
        await this.ensureIdle();
        let fullCacheKey = undefined;
        if (options.cacheKey != null) {
            const bucketIdentifiers = (_a = options.filter) !== null && _a !== void 0 ? _a : [];
            const buckets = [];
            for (const bucketIdentifier of bucketIdentifiers) {
                const bucket = await this.toOptionalBucketGivenIdentifier(bucketIdentifier);
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
                cacheData.expiresAt = now.withAddedDuration(time_1.Duration.givenSeconds(300));
                entryKeys = cacheData.entryKeys;
            }
        }
        if (entryKeys == null) {
            if (util_1.ArrayUtil.arrayIsEmptyOrNull(options.filter)) {
                entryKeys = await arrayGivenAsyncIterable(this.allEntryKeys());
            }
            else {
                const sets = [];
                for (const bucketIdentifier of options.filter) {
                    const bucket = await this.toOptionalBucketGivenIdentifier(bucketIdentifier);
                    if (bucket == null) {
                        sets.push(new Set());
                    }
                    else {
                        const entryKeys = await bucket.toEntryKeys();
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
                expiresAt: now.withAddedDuration(time_1.Duration.givenSeconds(300)),
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
        return result;
    }
    // TC: O(N)
    async forEach(fn) {
        var e_3, _a;
        const entryKeys = this.allEntryKeys();
        try {
            for (var entryKeys_1 = __asyncValues(entryKeys), entryKeys_1_1; entryKeys_1_1 = await entryKeys_1.next(), !entryKeys_1_1.done;) {
                const entryKey = entryKeys_1_1.value;
                const entry = await this.toOptionalEntryGivenKey(entryKey);
                await fn(entry);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (entryKeys_1_1 && !entryKeys_1_1.done && (_a = entryKeys_1.return)) await _a.call(entryKeys_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    }
    async hasEntry(entryKey) {
        const keys = await this.toEntryKeys();
        return keys.includes(entryKey);
    }
    async toEntryCount(filter) {
        const keys = await this.toEntryKeys({
            filter,
        });
        return keys.length;
    }
    async toEntries(options = {}) {
        const entryKeys = await this.toEntryKeys(options);
        const entries = [];
        for (const entryKey of entryKeys) {
            const result = await this.toOptionalEntryGivenKey(entryKey);
            if (result != null) {
                entries.push(result);
            }
        }
        return entries;
    }
    async toOptionalFirstEntry(options = {}) {
        const results = await this.toEntries(Object.assign(Object.assign({}, options), { limit: 1 }));
        return results[0];
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
        return __asyncGenerator(this, arguments, function* rebuildMetadata_1() {
            var e_4, _a;
            console.log(`Rebuilding metadata for ${this.props.label}...`);
            const entryKeys = this.allEntryKeys();
            try {
                for (var entryKeys_2 = __asyncValues(entryKeys), entryKeys_2_1; entryKeys_2_1 = yield __await(entryKeys_2.next()), !entryKeys_2_1.done;) {
                    const entryKey = entryKeys_2_1.value;
                    const entry = yield __await(this.toOptionalEntryGivenKey(entryKey));
                    if (entry == null) {
                        continue;
                    }
                    yield __await(this.rebuildMetadataGivenEntry(entry));
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (entryKeys_2_1 && !entryKeys_2_1.done && (_a = entryKeys_2.return)) yield __await(_a.call(entryKeys_2));
                }
                finally { if (e_4) throw e_4.error; }
            }
            console.log("Done rebuilding metadata");
        });
    }
    toBucketsGivenEntryKey(entryKey) {
        const self = this;
        function getItems() {
            return __asyncGenerator(this, arguments, function* getItems_1() {
                const dimensions = yield __await(self.toDimensions());
                for (const dimension of dimensions) {
                    const buckets = yield __await(dimension.toBuckets());
                    for (const bucket of buckets) {
                        yield yield __await(bucket);
                    }
                }
            });
        }
        return new SlowResult_1.SlowResult({
            getItems,
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
                    await this.writeEntryData(entry.data, entry.propertyValues, entry.key, entry.createdAt);
                }
                else {
                    const createdAt = entry.createdAtEpochMs != null
                        ? time_1.Instant.givenEpochMilliseconds(entry.createdAtEpochMs)
                        : undefined;
                    await this.writeEntryData(entry.data, entry.propertyValues, entry.key, createdAt);
                }
                break;
            default:
                throw new Error(`Unsupported entry status '${entry.status}'`);
        }
    }
    async writeEntryData(entryData, propertyValues = {}, entryKey, createdAt) {
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        let entry = await this.toOptionalEntryGivenKey(entryKey);
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