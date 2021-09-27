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
const uniquePortableTags_1 = require("./uniquePortableTags");
class ObjectDb extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this.collectionDidChange = new observable_1.TypedEvent();
        this.entryWillChange = new observable_1.TypedEvent();
        this.entryDidChange = new observable_1.TypedEvent();
        this._tagPrefixes = new Set();
        this._tagsByKey = new Map();
        this._tagsByHashcode = new Map();
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
    get tags() {
        return Array.from(this._tagsByKey.values());
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
      CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        properties TEXT NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS tags (
        key TEXT PRIMARY KEY,
        tagPrefix TEXT NOT NULL,
        tagValue TEXT NOT NULL
      )
    `);
        try {
            db.runQuery(`
        ALTER TABLE tags
        ADD COLUMN tagNormalizedValue TEXT
      `);
        }
        catch (err) {
            // ignore
        }
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
      CREATE INDEX IF NOT EXISTS idxTagPrefixValue
      ON tags(tagPrefix, tagNormalizedValue);
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
        this.stopwatch.start("pruneTagsAndMetrics");
        db.runQuery(`
      DELETE FROM tags WHERE key IN (
        SELECT t.key FROM tags AS t
        LEFT JOIN tagEntries AS te ON te.tagKey = t.key
        WHERE te.entryKey IS NULL
      );    
    `);
        db.runQuery(`
      DELETE FROM metrics WHERE key IN (
        SELECT m.key FROM metrics AS m
        LEFT JOIN metricValues AS mv ON mv.metricKey = m.key
        WHERE mv.entryKey IS NULL
      );    
    `);
        this.stopwatch.stop("pruneTagsAndMetrics");
        db.prepareCached("INSERT OR IGNORE INTO meta (id, properties) VALUES (0, ?)").run("{}");
        db.toRows("SELECT properties FROM meta").forEach((row) => {
            var _a;
            const properties = JSON.parse((_a = row.properties) !== null && _a !== void 0 ? _a : "{}");
            // assign property definitions
            for (const key of Object.keys(properties)) {
                this._properties.set(key, properties[key]);
            }
        });
        this.stopwatch.start("selectTagKeys");
        const tagRows = db.toRows("SELECT key, tagPrefix, tagValue, tagNormalizedValue FROM tags");
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
        const tagKeyCount = tagRows.length;
        for (let i = 0; i < tagKeyCount; i++) {
            const tagRow = tagRows[i];
            const { key, tagPrefix, tagValue, tagNormalizedValue } = tagRow;
            this.stopwatch.start("createTag");
            const tag = new Tag_1.Tag({
                tagKey: key,
                tagPrefix,
                tagValue,
                tagNormalizedValue,
                db: this._db,
                stopwatch: this.stopwatch,
            });
            this.stopwatch.stop("createTag");
            this.stopwatch.start("activateTag");
            this.addActor(tag);
            this.stopwatch.stop("activateTag");
            this._tagsByKey.set(key, tag);
            this._tagPrefixes.add(tag.tagPrefix);
            this._tagsByHashcode.set(tag.toHashCode(), tag);
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
        var _a, _b, _c;
        this.stopwatch.start("toEntryKeys");
        const now = time_1.Instant.ofNow();
        let entryKeys = undefined;
        let fullCacheKey = undefined;
        if (options.cacheKey != null) {
            const portableTags = (_a = options.requireTags) !== null && _a !== void 0 ? _a : [];
            const tags = portableTags.map((pt) => this.tagGivenPortableTag(pt, false));
            const hashCodes = tags.map(tag => tag.toHashCode());
            const cacheKeyData = `${options.cacheKey}:${(_b = options.orderByMetric) === null || _b === void 0 ? void 0 : _b.direction}:${(_c = options.orderByMetric) === null || _c === void 0 ? void 0 : _c.key}:${hashCodes.join(",")}`;
            fullCacheKey = util_1.StringUtil.hashCodeGivenString(cacheKeyData);
        }
        if (fullCacheKey != null) {
            const cacheData = this._caches.get(fullCacheKey);
            if (cacheData != null) {
                cacheData.expiresAt = now.withAddedDuration(time_1.Duration.givenSeconds(120));
                entryKeys = cacheData.entryKeys;
            }
        }
        if (entryKeys == null) {
            if (options.requireTags == null ||
                options.requireTags.length === 0) {
                entryKeys = Array.from(this._entryKeys);
            }
            else {
                const sets = options.requireTags.map((portableTag) => {
                    const tag = this.tagGivenPortableTag(portableTag, false);
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
        }
        if (options.cacheKey != null && !this._caches.has(fullCacheKey)) {
            this._caches.set(fullCacheKey, {
                entryKeys,
                expiresAt: now.withAddedDuration(time_1.Duration.givenSeconds(120)),
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
    toEntryCount(requireTags) {
        const keys = this.toEntryKeys({
            requireTags,
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
    setProperty(property) {
        this._properties.set(property.key, property);
        this.saveProperties();
    }
    deletePropertyKey(key) {
        this._properties.delete(key);
        this.saveProperties();
    }
    toPropertyGivenKey(key) {
        return this._properties.get(key);
    }
    toProperties() {
        return Array.from(this._properties.values());
    }
    saveProperties() {
        // convert this._properties to a plain javascript object
        const portableProperties = {};
        this._properties.forEach((property, key) => {
            portableProperties[key] = property;
        });
        this._db
            .prepareCached("UPDATE meta SET properties = ?")
            .run(JSON.stringify(portableProperties));
    }
    removeMetadataGivenEntryKey(entryKey) {
        const tagKeys = this._db
            .prepareCached("select distinct tagKey from tagEntries where entryKey = ?")
            .all(entryKey)
            .map((row) => row.tagKey);
        tagKeys.forEach((tagKey) => {
            const tag = this._tagsByKey.get(tagKey);
            if (tag != null) {
                tag.deleteEntryKey(entryKey);
            }
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
    tagGivenPropertyKeyAndValue(propertyKey, value) {
        if (propertyKey == null) {
            return;
        }
        const property = this.toPropertyGivenKey(propertyKey);
        if (property == null) {
            return;
        }
        switch (property.type) {
            case "select":
                return {
                    tagPrefix: property.key,
                    tagValue: value
                };
            default:
                return undefined;
        }
    }
    propertyTagKeysGivenEntry(entry) {
        const result = [];
        Object.keys(entry.propertyValues).forEach((key) => {
            const value = entry.propertyValues[key];
            const tag = this.tagGivenPropertyKeyAndValue(key, value);
            if (tag != null) {
                result.push(tag);
            }
        });
        return result;
    }
    rebuildMetadataGivenEntry(entry) {
        this.stopwatch.start("rebuildMetadataGivenEntry");
        this.removeMetadataGivenEntryKey(entry.key);
        const tags = [
            ...this.propertyTagKeysGivenEntry(entry),
            ...this.props.tagsGivenEntry(entry)
        ];
        const portableTags = uniquePortableTags_1.uniquePortableTags(tags);
        const metricValues = this.props.metricsGivenEntry(entry);
        metricValues.createdAt = entry.createdAt.toEpochMilliseconds().toString();
        metricValues.updatedAt = entry.updatedAt.toEpochMilliseconds().toString();
        portableTags.forEach((portableTag) => {
            const tag = this.tagGivenPortableTag(portableTag);
            tag.addEntryKey(entry.key);
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
            case "deleted":
                this.deleteEntryKey(entry.key);
                break;
            case "new":
            case "saved":
            case "updated":
            case "unknown":
                if ("createdAt" in entry) {
                    this.writeEntryData(entry.data, entry.propertyValues, entry.key, entry.createdAt);
                }
                else {
                    const createdAt = entry.createdAtEpochMs != null
                        ? time_1.Instant.givenEpochMilliseconds(entry.createdAtEpochMs)
                        : undefined;
                    this.writeEntryData(entry.data, entry.propertyValues, entry.key, createdAt);
                }
                break;
            default:
                throw new Error(`Unsupported entry status '${entry.status}'`);
        }
    }
    tagGivenPortableTag(portableTag, createIfMissing = false) {
        const normalizedValue = Tag_1.normalizedValueGivenString(portableTag.tagValue);
        const hashCode = Tag_1.hashCodeGivenTagPrefixAndNormalizedValue(portableTag.tagPrefix, normalizedValue);
        let tag = this._tagsByHashcode.get(hashCode);
        if (tag == null && createIfMissing == true) {
            const tagKey = util_1.StringUtil.stringOfRandomCharacters(12);
            tag = this.addActor(new Tag_1.Tag({
                tagKey,
                tagPrefix: portableTag.tagPrefix,
                tagValue: portableTag.tagValue,
                db: this._db,
                stopwatch: this.stopwatch,
            }));
            this._tagsByKey.set(tagKey, tag);
            this._tagPrefixes.add(portableTag.tagPrefix);
            this._tagsByHashcode.set(hashCode, tag);
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
    writeEntryData(entryData, propertyValues = {}, entryKey, createdAt) {
        var _a;
        if (entryKey == null) {
            entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
        }
        if (entryKey.length < 5) {
            throw new Error("Entry key length must be at least 5 characters");
        }
        const oldPortableEntry = (_a = this.toOptionalEntryGivenKey(entryKey)) === null || _a === void 0 ? void 0 : _a.toPortableEntry();
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
        entry.propertyValues = propertyValues;
        this.stopwatch.start("save");
        entry.save();
        this.stopwatch.stop("save");
        this._entryKeys.add(entryKey);
        this.rebuildMetadataGivenEntry(entry);
        if (didCreateNewEntry) {
            this.collectionDidChange.emit();
        }
        this.entryDidChange.emit(change);
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
        const change = {
            key: entryKey,
            oldData: existingRecord.data,
        };
        this.entryWillChange.emit(change);
        this.removeMetadataGivenEntryKey(entryKey);
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