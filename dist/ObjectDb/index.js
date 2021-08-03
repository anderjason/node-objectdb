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
const Tag_1 = require("../Tag");
class ObjectDb extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this.collectionDidChange = new observable_1.TypedEvent();
        this.entryWillChange = new observable_1.TypedEvent();
        this.entryDidChange = new observable_1.TypedEvent();
        this._tagPrefixes = new Set();
        this._tags = new Map();
        this._metrics = new Map();
        this._entryKeys = new Set();
        this.stopwatch = new time_1.Stopwatch(props.localFile.toAbsolutePath());
    }
    onActivate() {
        this._db = this.addActor(new SqlClient_1.DbInstance({
            localFile: this.props.localFile,
        }));
        this.load();
    }
    get tags() {
        return Array.from(this._tags.values());
    }
    get metrics() {
        return Array.from(this._metrics.values());
    }
    get tagPrefixes() {
        return Array.from(this._tagPrefixes);
    }
    load() {
        if (this.isActive == false) {
            return;
        }
        const db = this._db;
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS tags (
        key TEXT PRIMARY KEY,
        tagPrefix TEXT NOT NULL,
        tagValue TEXT NOT NULL
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
      CREATE TABLE IF NOT EXISTS tagEntries (
        tagKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        FOREIGN KEY(tagKey) REFERENCES tags(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key),
        UNIQUE(tagKey, entryKey)
      )
    `);
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
      CREATE INDEX IF NOT EXISTS idxTagPrefix 
      ON tags(tagPrefix);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesTagKey 
      ON tagEntries(tagKey);
    `);
        db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesEntryKey
      ON tagEntries(entryKey);
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
        this.stopwatch.start("selectTagKeys");
        const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);
        this.stopwatch.stop("selectTagKeys");
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
        this.stopwatch.start("createTags");
        const tagKeyCount = tagKeys.length;
        for (let i = 0; i < tagKeyCount; i++) {
            const tagKey = tagKeys[i];
            this.stopwatch.start("createTag");
            const tag = new Tag_1.Tag({
                tagKey,
                db: this._db,
                stopwatch: this.stopwatch
            });
            this.stopwatch.stop("createTag");
            this.stopwatch.start("activateTag");
            this.addActor(tag);
            this.stopwatch.stop("activateTag");
            this._tags.set(tagKey, tag);
            this._tagPrefixes.add(tag.tagPrefix);
        }
        this.stopwatch.stop("createTags");
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
    }
    toEntryKeys(options = {}) {
        this.stopwatch.start("toEntryKeys");
        let entryKeys;
        if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
            entryKeys = Array.from(this._entryKeys);
        }
        else {
            const sets = options.requireTagKeys.map((tagKey) => {
                const tag = this._tags.get(tagKey);
                if (tag == null) {
                    return new Set();
                }
                return new Set(tag.entryKeys.values());
            });
            entryKeys = Array.from(util_1.SetUtil.intersectionGivenSets(sets));
        }
        const order = options.orderByMetric;
        if (order != null) {
            const metric = this._metrics.get(order.key);
            if (metric != null) {
                entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (entryKey) => {
                    return metric.entryMetricValues.get(entryKey);
                }, order.direction);
            }
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
    forEach(fn) {
        this._entryKeys.forEach((entryKey) => {
            const entry = this.toOptionalEntryGivenKey(entryKey);
            fn(entry);
        });
    }
    hasEntry(entryKey) {
        const keys = this.toEntryKeys();
        return keys.includes(entryKey);
    }
    runTransaction(fn) {
        let failed = false;
        this._db.runTransaction(() => {
            try {
                fn();
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
    toEntryCount(requireTagKeys) {
        const keys = this.toEntryKeys({
            requireTagKeys: requireTagKeys,
        });
        return keys.length;
    }
    toEntries(options = {}) {
        const entryKeys = this.toEntryKeys(options);
        const entries = [];
        entryKeys.forEach((entryKey) => {
            const result = this.toOptionalEntryGivenKey(entryKey);
            if (result != null) {
                entries.push(result);
            }
        });
        return entries;
    }
    toOptionalFirstEntry(options = {}) {
        const results = this.toEntries(Object.assign(Object.assign({}, options), { limit: 1 }));
        return results[0];
    }
    toEntryGivenKey(entryKey) {
        const result = this.toOptionalEntryGivenKey(entryKey);
        if (result == null) {
            throw new Error(`Entry not found for key '${entryKey}'`);
        }
        return result;
    }
    toOptionalEntryGivenKey(entryKey) {
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
        });
        const didLoad = result.load();
        this.stopwatch.stop("toOptionalEntryGivenKey");
        if (!didLoad) {
            return undefined;
        }
        return result;
    }
    removeMetadataGivenEntryKey(entryKey) {
        const tagKeys = this._db
            .prepareCached("select distinct tagKey from tagEntries where entryKey = ?")
            .all(entryKey)
            .map((row) => row.tagKey);
        tagKeys.forEach((tagKey) => {
            const tag = this.tagGivenTagKey(tagKey);
            tag.deleteValue(entryKey);
        });
        const metricKeys = this._db
            .prepareCached("select distinct metricKey from metricValues where entryKey = ?")
            .all(entryKey)
            .map((row) => row.metricKey);
        metricKeys.forEach((metricKey) => {
            const metric = this.metricGivenMetricKey(metricKey);
            metric.deleteKey(entryKey);
        });
    }
    rebuildMetadata() {
        this.toEntryKeys().forEach((entryKey) => {
            const entry = this.toOptionalEntryGivenKey(entryKey);
            if (entry != null) {
                this.rebuildMetadataGivenEntry(entry);
            }
        });
    }
    rebuildMetadataGivenEntry(entry) {
        this.stopwatch.start("rebuildMetadataGivenEntry");
        this.removeMetadataGivenEntryKey(entry.key);
        const tagKeys = this.props.tagKeysGivenEntryData(entry.data);
        const metricValues = this.props.metricsGivenEntryData(entry.data);
        metricValues.createdAt = entry.createdAt.toEpochMilliseconds().toString();
        metricValues.updatedAt = entry.updatedAt.toEpochMilliseconds().toString();
        tagKeys.forEach((tagKey) => {
            const tag = this.tagGivenTagKey(tagKey);
            tag.addValue(entry.key);
        });
        Object.keys(metricValues).forEach((metricKey) => {
            const metric = this.metricGivenMetricKey(metricKey);
            const metricValue = metricValues[metricKey];
            metric.setValue(entry.key, metricValue);
        });
        this.stopwatch.stop("rebuildMetadataGivenEntry");
    }
    writeEntry(entry) {
        if (entry == null) {
            throw new Error("Entry is required");
        }
        switch (entry.status) {
            case "saved":
                console.log(`Skipping write because status for entry '${entry.key}' is already saved`);
                return;
            case "deleted":
                this.deleteEntryKey(entry.key);
                break;
            case "new":
            case "updated":
            case "unknown":
                if ("createdAt" in entry) {
                    this.writeEntryData(entry.data, entry.key, entry.createdAt);
                }
                else {
                    const createdAt = entry.createdAtEpochMs != null ? time_1.Instant.givenEpochMilliseconds(entry.createdAtEpochMs) : undefined;
                    this.writeEntryData(entry.data, entry.key, createdAt);
                }
                break;
            default:
                throw new Error(`Unsupported entry status '${entry.status}'`);
        }
    }
    tagGivenTagKey(tagKey) {
        let tag = this._tags.get(tagKey);
        if (tag == null) {
            tag = this.addActor(new Tag_1.Tag({
                tagKey,
                db: this._db,
                stopwatch: this.stopwatch
            }));
            this._tags.set(tagKey, tag);
        }
        return tag;
    }
    metricGivenMetricKey(metricKey) {
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
    writeEntryData(entryData, entryKey, createdAt) {
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        this.entryWillChange.emit(entryKey);
        this.stopwatch.start("writeEntryData");
        const now = time_1.Instant.ofNow();
        let didCreateNewEntry = false;
        let entry = this.toOptionalEntryGivenKey(entryKey);
        if (entry == null) {
            entry = new Entry_1.Entry({
                key: entryKey,
                db: this._db,
                createdAt: createdAt || now,
                updatedAt: now,
            });
            didCreateNewEntry = true;
        }
        entry.data = entryData;
        this.stopwatch.start("save");
        entry.save();
        this.stopwatch.stop("save");
        this._entryKeys.add(entryKey);
        this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(entryKey);
        this.stopwatch.stop("writeEntryData");
        return entry;
    }
    deleteEntryKey(entryKey) {
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const existingRecord = this.toOptionalEntryGivenKey(entryKey);
        if (existingRecord == null) {
            return;
        }
        this.entryWillChange.emit(entryKey);
        this.removeMetadataGivenEntryKey(entryKey);
        this._db.runQuery(`
      DELETE FROM entries WHERE key = ?
    `, [entryKey]);
        this._entryKeys.delete(entryKey);
        this.entryDidChange.emit(entryKey);
        this.collectionDidChange.emit();
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map