"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectDb = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const Broadcast_1 = require("../Broadcast");
const Entry_1 = require("../Entry");
const Metric_1 = require("../Metric");
const SqlClient_1 = require("../SqlClient");
const Tag_1 = require("../Tag");
class ObjectDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this.broadcast = new Broadcast_1.Broadcast();
        this.entriesDidChange = new observable_1.TypedEvent();
        this._tagPrefixes = new Set();
        this._tags = new Map();
        this._metrics = new Map();
        this._entryLabelByKey = new Map();
        this._entryKeysSortedByLabel = [];
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
        label TEXT,
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
        metricValue INTEGER NOT NULL,
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
        const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);
        db
            .toRows("SELECT key, label FROM entries ORDER BY label")
            .forEach((row) => {
            this._entryLabelByKey.set(row.key, row.label);
        });
        this.sortEntryKeys();
        const metricKeys = db
            .toRows("SELECT key FROM metrics")
            .map((row) => row.key);
        const tagKeyCount = tagKeys.length;
        for (let i = 0; i < tagKeyCount; i++) {
            const tagKey = tagKeys[i];
            const tag = this.addActor(new Tag_1.Tag({
                tagKey,
                db: this._db,
            }));
            this._tags.set(tagKey, tag);
            this._tagPrefixes.add(tag.tagPrefix);
        }
        const metricKeyCount = metricKeys.length;
        for (let i = 0; i < metricKeyCount; i++) {
            const metricKey = metricKeys[i];
            const metric = this.addActor(new Metric_1.Metric({
                metricKey,
                db: this._db,
            }));
            this._metrics.set(metricKey, metric);
        }
    }
    sortEntryKeys() {
        let objects = [];
        for (let [key, value] of this._entryLabelByKey) {
            objects.push({
                entryKey: key,
                label: value
            });
        }
        objects = util_1.ArrayUtil.arrayWithOrderFromValue(objects, obj => {
            if (obj.label == null) {
                return "";
            }
            return obj.label.toLowerCase();
        }, "ascending");
        this._entryKeysSortedByLabel = objects.map(obj => obj.entryKey);
    }
    toEntryKeys(options = {}) {
        let entryKeys;
        if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
            entryKeys = this._entryKeysSortedByLabel;
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
            if (metric != null) {
                entryKeys = util_1.ArrayUtil.arrayWithOrderFromValue(entryKeys, (entryKey) => {
                    const metricValue = metric.entryMetricValues.toOptionalValueGivenKey(entryKey);
                    return metricValue || 0;
                }, "ascending");
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
        return entryKeys.slice(start, end);
    }
    forEach(fn) {
        this._entryKeysSortedByLabel.forEach(entryKey => {
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
        const result = new Entry_1.Entry({
            key: entryKey,
            db: this._db,
        });
        if (!result.load()) {
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
            tag.entryKeys.removeValue(entryKey);
        });
        const metricKeys = this._db
            .prepareCached("select distinct metricKey from metricValues where entryKey = ?")
            .all(entryKey)
            .map((row) => row.metricKey);
        metricKeys.forEach((metricKey) => {
            const metric = this.metricGivenMetricKey(metricKey);
            metric.entryMetricValues.removeKey(entryKey);
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
        this.removeMetadataGivenEntryKey(entry.key);
        const tagKeys = this.props.tagKeysGivenEntryData(entry.data);
        const metricValues = this.props.metricsGivenEntryData(entry.data);
        tagKeys.forEach((tagKey) => {
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
        this.writeEntryData(entry.data, entry.key, entry.createdAt, entry.label);
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
    writeEntryData(entryData, entryKey, createdAt, label) {
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const now = time_1.Instant.ofNow();
        let didCreateNewEntry = false;
        let entry = this.toOptionalEntryGivenKey(entryKey);
        if (entry == null) {
            entry = new Entry_1.Entry({
                key: entryKey,
                db: this._db,
                label,
                createdAt: createdAt || now,
                updatedAt: now,
            });
            didCreateNewEntry = true;
        }
        entry.data = entryData;
        entry.save();
        if (this._entryLabelByKey.get(entryKey) !== label) {
            this._entryLabelByKey.set(entryKey, label);
            this.sortEntryKeys();
        }
        this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.entriesDidChange.emit();
        }
        this.broadcast.emit(entryKey);
        return entry;
    }
    deleteEntryKey(entryKey) {
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        this._entryLabelByKey.delete(entryKey);
        const existingRecord = this.toOptionalEntryGivenKey(entryKey);
        if (existingRecord == null) {
            return;
        }
        this.removeMetadataGivenEntryKey(entryKey);
        this._db.runQuery(`
      DELETE FROM entries WHERE key = ?
    `, [entryKey]);
        this.broadcast.emit(entryKey);
        this.entriesDidChange.emit();
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map