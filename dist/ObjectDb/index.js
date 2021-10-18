"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectDb = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const Entry_1 = require("../Entry");
const Metric_1 = require("../Metric");
class ObjectDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this.collectionDidChange = new observable_1.TypedEvent();
        this.entryWillChange = new observable_1.TypedEvent();
        this.entryDidChange = new observable_1.TypedEvent();
        this._isLoaded = observable_1.Observable.givenValue(false, observable_1.Observable.isStrictEqual);
        this.isLoaded = observable_1.ReadOnlyObservable.givenObservable(this._isLoaded);
        this._dimensionsByKey = new Map();
        this._metrics = new Map();
        this._properties = new Map();
        this._entryKeys = new Set();
        this._caches = new Map();
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
    get metrics() {
        return Array.from(this._metrics.values());
    }
    async load() {
        if (this.isActive == false) {
            return;
        }
        const db = this._db;
        // db.toRows("SELECT key, definition FROM properties").forEach((row) => {
        //   const { key, definition } = row;
        //   // assign property definitions
        //   this._properties.set(key, JSON.parse(definition));
        // });
        const entries = await this._db.collection("entries").find().toArray();
        entries.forEach((row) => {
            const { key } = row;
            this._entryKeys.add(key);
        });
        const metrics = await this._db.collection("metrics").find().toArray();
        const metricKeys = metrics.map((row) => row.key);
        const metricKeyCount = metricKeys.length;
        for (let i = 0; i < metricKeyCount; i++) {
            const metricKey = metricKeys[i];
            const metric = this.addActor(new Metric_1.Metric({
                metricKey,
                db: this._db,
            }));
            this._metrics.set(metricKey, metric);
        }
        if (this.props.dimensions != null) {
            for (const dimension of this.props.dimensions) {
                dimension.db = this._db;
                dimension.objectDb = this;
                this.addActor(dimension);
                await dimension.load();
                this._dimensionsByKey.set(dimension.key, dimension);
            }
        }
        this._isLoaded.setValue(true);
    }
    async toEntryKeys(options = {}) {
        var _a, _b, _c;
        const now = time_1.Instant.ofNow();
        let entryKeys = undefined;
        let fullCacheKey = undefined;
        if (options.cacheKey != null) {
            const bucketIdentifiers = (_a = options.filter) !== null && _a !== void 0 ? _a : [];
            const buckets = [];
            for (const bucketIdentifier of bucketIdentifiers) {
                const bucket = this.toOptionalBucketGivenIdentifier(bucketIdentifier);
                if (bucket != null) {
                    buckets.push(bucket);
                }
            }
            const hashCodes = buckets.map((bucket) => bucket.toHashCode());
            const cacheKeyData = `${options.cacheKey}:${(_b = options.orderByMetric) === null || _b === void 0 ? void 0 : _b.direction}:${(_c = options.orderByMetric) === null || _c === void 0 ? void 0 : _c.key}:${hashCodes.join(",")}`;
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
            if (options.filter == null || options.filter.length === 0) {
                entryKeys = Array.from(this._entryKeys);
            }
            else {
                const sets = [];
                for (const bucketIdentifier of options.filter) {
                    const bucket = this.toOptionalBucketGivenIdentifier(bucketIdentifier);
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
            const order = options.orderByMetric;
            if (order != null) {
                const metric = this._metrics.get(order.key);
                if (metric != null) {
                    const entryMetricValues = await metric.toEntryMetricValues();
                    entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (entryKey) => {
                        return entryMetricValues.get(entryKey);
                    }, order.direction);
                }
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
        for (const entryKey of this._entryKeys) {
            const entry = await this.toOptionalEntryGivenKey(entryKey);
            await fn(entry);
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
    toDimensions() {
        return this._dimensionsByKey.values();
    }
    async setProperty(property) { }
    async deletePropertyKey(key) { }
    async toPropertyGivenKey(key) {
        return undefined;
    }
    async toProperties() {
        return [];
    }
    async removeMetadataGivenEntryKey(entryKey) {
        for (const dimension of this._dimensionsByKey.values()) {
            await dimension.deleteEntryKey(entryKey);
        }
        const metricValues = await this._db.collection("metricValues").find({ entryKey: entryKey }).toArray();
        const metricKeys = metricValues.map((metricValue) => metricValue.metricKey);
        for (const metricKey of metricKeys) {
            const metric = await this.metricGivenMetricKey(metricKey);
            metric.deleteKey(entryKey);
        }
    }
    async rebuildMetadata() {
        console.log(`Rebuilding metadata for ${this.props.label}...`);
        const entryKeys = await this.toEntryKeys();
        console.log(`Found ${entryKeys.length} entries`);
        for (const entryKey of entryKeys) {
            const entry = await this.toOptionalEntryGivenKey(entryKey);
            if (entry != null) {
                await this.rebuildMetadataGivenEntry(entry);
            }
        }
        console.log("Done rebuilding metadata");
    }
    toOptionalBucketGivenIdentifier(bucketIdentifier) {
        if (bucketIdentifier == null) {
            return undefined;
        }
        const dimension = this._dimensionsByKey.get(bucketIdentifier.dimensionKey);
        if (dimension == null) {
            return undefined;
        }
        return dimension.toOptionalBucketGivenKey(bucketIdentifier.bucketKey);
    }
    async rebuildMetadataGivenEntry(entry) {
        await this.removeMetadataGivenEntryKey(entry.key);
        const metricValues = this.props.metricsGivenEntry(entry);
        metricValues.createdAt = entry.createdAt.toEpochMilliseconds().toString();
        metricValues.updatedAt = entry.updatedAt.toEpochMilliseconds().toString();
        for (const dimension of this._dimensionsByKey.values()) {
            await dimension.entryDidChange(entry.key);
        }
        for (const metricKey of Object.keys(metricValues)) {
            const metric = await this.metricGivenMetricKey(metricKey);
            const metricValue = metricValues[metricKey];
            metric.setValue(entry.key, metricValue);
        }
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
    async metricGivenMetricKey(metricKey) {
        let metric = this._metrics.get(metricKey);
        if (metric == null) {
            metric = this.addActor(new Metric_1.Metric({
                metricKey,
                db: this._db,
            }));
            this._metrics.set(metricKey, metric);
        }
        return metric;
    }
    async writeEntryData(entryData, propertyValues = {}, entryKey, createdAt) {
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const oldEntry = await this.toOptionalEntryGivenKey(entryKey);
        const oldPortableEntry = oldEntry === null || oldEntry === void 0 ? void 0 : oldEntry.toPortableEntry();
        const oldData = oldPortableEntry === null || oldPortableEntry === void 0 ? void 0 : oldPortableEntry.data;
        const oldPropertyValues = oldPortableEntry === null || oldPortableEntry === void 0 ? void 0 : oldPortableEntry.propertyValues;
        if (util_1.ObjectUtil.objectIsDeepEqual(oldData, entryData) &&
            util_1.ObjectUtil.objectIsDeepEqual(oldPropertyValues, propertyValues)) {
            // nothing changed
            return;
        }
        const change = {
            key: entryKey,
            oldData,
            newData: entryData,
        };
        this.entryWillChange.emit(change);
        const now = time_1.Instant.ofNow();
        let didCreateNewEntry = false;
        let entry = await this.toOptionalEntryGivenKey(entryKey);
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
        await entry.save();
        this._entryKeys.add(entryKey);
        await this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(change);
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
            oldData: existingRecord.data,
        };
        this.entryWillChange.emit(change);
        await this.removeMetadataGivenEntryKey(entryKey);
        await this._db.collection("entries").deleteOne({ id: entryKey });
        this._entryKeys.delete(entryKey);
        this.entryDidChange.emit(change);
        this.collectionDidChange.emit();
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map