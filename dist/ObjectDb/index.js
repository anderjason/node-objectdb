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
const SqlClient_1 = require("../SqlClient");
class ObjectDb extends skytree_1.Actor {
    constructor(props) {
        super(props);
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
        this.stopwatch = new time_1.Stopwatch(props.localFile.toAbsolutePath());
    }
    onActivate() {
        this._db = this.addActor(new SqlClient_1.DbInstance({
            localFile: this.props.localFile,
        }));
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
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        properties TEXT NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS metrics (
        key text PRIMARY KEY
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS entries (
        key text PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS dimensions (
        key text PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS properties (
        key text PRIMARY KEY,
        definition TEXT NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS propertyValues (
        entryKey TEXT NOT NULL,
        propertyKey TEXT NOT NULL,
        propertyValue TEXT NOT NULL,
        FOREIGN KEY(propertyKey) REFERENCES properties(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key),
        UNIQUE(propertyKey, entryKey)
      )
    `);
        try {
            db.runQuery(`
        ALTER TABLE entries
        ADD COLUMN propertyValues TEXT
      `);
        }
        catch (err) {
            // ignore
        }
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue TEXT NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
        UNIQUE(metricKey, entryKey)
      )
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesMetricKey
      ON metricValues(metricKey);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesEntryKey
      ON metricValues(entryKey);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesMetricValue
      ON metricValues(metricValue);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idsPropertyValuesEntryKey
      ON propertyValues(entryKey);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxPropertyValuesPropertyKey
      ON propertyValues(propertyKey);
    `);
        db.prepareCached("INSERT OR IGNORE INTO meta (id, properties) VALUES (0, ?)").run("{}");
        db.toRows("SELECT key, definition FROM properties").forEach((row) => {
            const { key, definition } = row;
            // assign property definitions
            this._properties.set(key, JSON.parse(definition));
        });
        this.stopwatch.start("selectEntryKeys");
        db.toRows("SELECT key FROM entries").forEach((row) => {
            this._entryKeys.add(row.key);
        });
        this.stopwatch.stop("selectEntryKeys");
        this.stopwatch.start("selectMetricKeys");
        const metricKeys = db
            .toRows("SELECT key FROM metrics")
            .map((row) => row.key);
        this.stopwatch.stop("selectMetricKeys");
        this.stopwatch.start("createMetrics");
        const metricKeyCount = metricKeys.length;
        for (let i = 0; i < metricKeyCount; i++) {
            const metricKey = metricKeys[i];
            const metric = this.addActor(new Metric_1.Metric({
                metricKey,
                db: this._db,
            }));
            this._metrics.set(metricKey, metric);
        }
        this.stopwatch.stop("createMetrics");
        this.stopwatch.start("addDimensions");
        if (this.props.dimensions != null) {
            for (const dimension of this.props.dimensions) {
                dimension.db = this._db;
                dimension.objectDb = this;
                this.addActor(dimension);
                await dimension.load();
                this._dimensionsByKey.set(dimension.key, dimension);
            }
        }
        this.stopwatch.stop("addDimensions");
        this._isLoaded.setValue(true);
    }
    async toEntryKeys(options = {}) {
        var _a, _b, _c;
        this.stopwatch.start("toEntryKeys");
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
        this.stopwatch.stop("toEntryKeys");
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
    async runTransaction(fn) {
        let failed = false;
        this._db.runTransaction(async () => {
            try {
                await fn();
            }
            catch (err) {
                failed = true;
                console.error(err);
            }
        });
        if (failed) {
            throw new Error("The transaction failed, and the ObjectDB instance in memory may be out of sync. You should reload the ObjectDb instance.");
        }
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
        this.stopwatch.start("toOptionalEntryGivenKey");
        const result = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
            objectDb: this,
        });
        const didLoad = await result.load();
        this.stopwatch.stop("toOptionalEntryGivenKey");
        if (!didLoad) {
            return undefined;
        }
        return result;
    }
    async setProperty(property) {
    }
    async deletePropertyKey(key) {
    }
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
        const metricKeys = this._db
            .prepareCached("select distinct metricKey from metricValues where entryKey = ?")
            .all(entryKey)
            .map((row) => row.metricKey);
        for (const metricKey of metricKeys) {
            const metric = await this.metricGivenMetricKey(metricKey);
            metric.deleteKey(entryKey);
        }
    }
    async rebuildMetadata() {
        const entryKeys = await this.toEntryKeys();
        for (const entryKey of entryKeys) {
            const entry = await this.toOptionalEntryGivenKey(entryKey);
            if (entry != null) {
                await this.rebuildMetadataGivenEntry(entry);
            }
        }
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
        this.stopwatch.start("rebuildMetadataGivenEntry");
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
        this.stopwatch.stop("rebuildMetadataGivenEntry");
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
        this.stopwatch.start("writeEntryData");
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
        this.stopwatch.start("save");
        await entry.save();
        this.stopwatch.stop("save");
        this._entryKeys.add(entryKey);
        await this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(change);
        this.stopwatch.stop("writeEntryData");
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
        this._db.runQuery(`
      DELETE FROM entries WHERE key = ?
    `, [entryKey]);
        this._entryKeys.delete(entryKey);
        this.entryDidChange.emit(change);
        this.collectionDidChange.emit();
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map