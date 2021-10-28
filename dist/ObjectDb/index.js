"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectDb = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const Benchmark_1 = require("../Benchmark");
const Dimension_1 = require("../Dimension");
const Entry_1 = require("../Entry");
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
        this._isLoaded.setValue(true);
    }
    async ensureIdle() {
        // console.log(`Waiting for ObjectDB idle in ${this.props.label}...`);
        await this._isLoaded.toPromise((v) => v);
        // console.log(`ObjectDb is idle in ${this.props.label}`);
    }
    async allEntryKeys() {
        const entries = await this._db
            .collection("entries")
            .find({}, {
            projection: { key: 1 },
        })
            .toArray();
        return entries.map((row) => row.key);
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
                entryKeys = await this.allEntryKeys();
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
                entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, e => Math.random(), "ascending");
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
        const entryKeys = await this.allEntryKeys();
        for (const entryKey of entryKeys) {
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
    async toDimensions() {
        return [...this._dimensions];
    }
    async setProperty(property) { }
    async deletePropertyKey(key) { }
    async toPropertyGivenKey(key) {
        return undefined;
    }
    async toProperties() {
        return [];
    }
    async rebuildMetadataGivenEntry(entry) {
        const timer = this.stopwatch.start("rebuildMetadataGivenEntry");
        const dimensions = await this.toDimensions();
        await Promise.all(dimensions.map((dimension) => dimension.rebuildEntry(entry)));
        timer.stop();
    }
    async rebuildMetadata() {
        console.log(`Rebuilding metadata for ${this.props.label}...`);
        const totalCount = await this._db
            .collection("entries")
            .countDocuments();
        const benchmark = new Benchmark_1.Benchmark(totalCount, this.props.rebuildBucketSize, () => {
            this.stopwatch.report();
        });
        await this.forEach(async (entry) => {
            benchmark.log(`Rebuilding ${entry.key}`);
            await this.rebuildMetadataGivenEntry(entry);
        });
        console.log("Done rebuilding metadata");
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
        return dimension.toOptionalBucketGivenKey(bucketIdentifier.bucketKey);
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