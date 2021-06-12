"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectDb = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const skytree_1 = require("skytree");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const LRUCache_1 = require("../LRUCache");
const Metric_1 = require("../Metric");
const Tag_1 = require("../Tag");
const Entry_1 = require("../Entry");
const SqlClient_1 = require("../SqlClient");
class ObjectDb extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this._tagPrefixes = new Set();
        this._tags = new Map();
        this._metrics = new Map();
        this._allEntryKeys = new Set();
        this._entryCache = new LRUCache_1.LRUCache(props.cacheSize || 10);
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
        if (this.isActive.value == false) {
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
        UNIQUE(tagKey, entryKey) ON CONFLICT IGNORE
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue INTEGER NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
        UNIQUE(metricKey, entryKey) ON CONFLICT REPLACE
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
        const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);
        const entryKeys = db
            .toRows("SELECT key FROM entries")
            .map((row) => row.key);
        const metricKeys = db
            .toRows("SELECT key FROM metrics")
            .map((row) => row.key);
        tagKeys.forEach((tagKey) => {
            const tag = this.addActor(new Tag_1.Tag({
                tagKey,
                db: this._db,
            }));
            this._tags.set(tagKey, tag);
            this._tagPrefixes.add(tag.tagPrefix);
        });
        metricKeys.forEach((metricKey) => {
            const metric = this.addActor(new Metric_1.Metric({
                metricKey,
                db: this._db,
            }));
            this._metrics.set(metricKey, metric);
        });
        this._allEntryKeys = new Set(entryKeys);
    }
    toEntryKeys(options = {}) {
        let entryKeys;
        if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
            entryKeys = Array.from(this._allEntryKeys);
        }
        else {
            const sets = options.requireTagKeys.map((tagKey) => {
                const tag = this._tags.get(tagKey);
                if (tag == null) {
                    return new Set();
                }
                return tag.entryKeys.toSet();
            });
            entryKeys = Array.from(util_1.SetUtil.intersectionGivenSets(sets));
        }
        const metricKey = options.orderByMetricKey;
        if (metricKey != null) {
            const metric = this._metrics.get(metricKey);
            if (metric == null) {
                throw new Error(`Metric is not defined '${metricKey}'`);
            }
            entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (entryKey) => {
                const metricValue = metric.entryMetricValues.toOptionalValueGivenKey(entryKey);
                return metricValue || 0;
            }, "ascending");
        }
        let start = 0;
        let end = entryKeys.length;
        if (options.offset != null) {
            start = parseInt(options.offset, 10);
        }
        if (options.limit != null) {
            end = Math.min(end, start + parseInt(options.limit, 10));
        }
        return entryKeys.slice(start, end);
    }
    hasEntry(entryKey) {
        const keys = this.toEntryKeys();
        return keys.includes(entryKey);
    }
    runTransaction(fn) {
        this._db.runTransaction(fn);
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
        const cachedEntry = this._entryCache.get(entryKey);
        if (cachedEntry != null) {
            return cachedEntry;
        }
        const result = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
        });
        if (!result.load()) {
            return undefined;
        }
        this._entryCache.put(entryKey, result);
        return result;
    }
    removeMetadataGivenEntryKey(entryKey) {
        const tagKeys = this._db.prepareCached("select distinct tagKey from tagEntries where entryKey = ?").all(entryKey).map(row => row.tagKey);
        tagKeys.forEach(tagKey => {
            const tag = this.tagGivenTagKey(tagKey);
            tag.entryKeys.removeValue(entryKey);
        });
        const metricKeys = this._db.prepareCached("select distinct metricKeys from metricValues where entryKey = ?").all(entryKey).map(row => row.metricKey);
        metricKeys.forEach(metricKey => {
            const metric = this.metricGivenMetricKey(metricKey);
            metric.entryMetricValues.removeKey(entryKey);
        });
    }
    rebuildMetadata() {
        this.toEntryKeys().forEach(entryKey => {
            const entry = this.toOptionalEntryGivenKey(entryKey);
            if (entry != null) {
                this.rebuildMetadataGivenEntry(entry);
            }
        });
    }
    rebuildMetadataGivenEntry(entry) {
        this.removeMetadataGivenEntryKey(entry.key);
        const tagKeys = this.props.tagKeysGivenEntryData(entry.data);
        const metricValues = this.props.metricsGivenEntryData(entry.data);
        tagKeys.forEach(tagKey => {
            const tag = this.tagGivenTagKey(tagKey);
            tag.entryKeys.addValue(entry.key);
        });
        Object.keys(metricValues).forEach((metricKey) => {
            const metric = this.metricGivenMetricKey(metricKey);
            const metricValue = metricValues[metricKey];
            metric.entryMetricValues.setValue(entry.key, metricValue);
        });
    }
    writeEntry(entry) {
        if (entry == null) {
            throw new Error("Entry is required");
        }
        this.writeEntryData(entry.data, entry.key, entry.createdAt);
        return entry;
    }
    tagGivenTagKey(tagKey) {
        let tag = this._tags.get(tagKey);
        if (tag == null) {
            tag = this.addActor(new Tag_1.Tag({
                tagKey,
                db: this._db,
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
        const now = time_1.Instant.ofNow();
        const entry = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
            createdAt: createdAt || now,
            updatedAt: now
        });
        entry.data = entryData;
        entry.save();
        this._entryCache.put(entryKey, entry);
        this._allEntryKeys.add(entryKey);
        this.rebuildMetadataGivenEntry(entry);
        return entry;
    }
    deleteEntryKey(entryKey) {
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        this._entryCache.remove(entryKey);
        this._allEntryKeys.delete(entryKey);
        const existingRecord = this.toOptionalEntryGivenKey(entryKey);
        if (existingRecord == null) {
            return;
        }
        this.removeMetadataGivenEntryKey(entryKey);
        this._db.runQuery(`
      DELETE FROM entries WHERE key = ?
    `, [entryKey]);
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map