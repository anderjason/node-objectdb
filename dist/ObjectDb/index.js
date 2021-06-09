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
        this._instructions = [];
        this._deleteEntry = async (entryKey) => {
            if (entryKey.length < 5) {
                throw new Error("Entry key length must be at least 5 characters");
            }
            this._entryCache.remove(entryKey);
            this._allEntryKeys.delete(entryKey);
            const existingRecord = await this.toOptionalEntryGivenKey(entryKey);
            if (existingRecord == null) {
                return;
            }
            const changedTags = new Set();
            const changedMetrics = new Set();
            existingRecord.tagKeys.forEach((tagKey) => {
                const tag = this._tags.get(tagKey);
                if (tag != null && tag.entryKeys.has(entryKey)) {
                    tag.entryKeys.delete(entryKey);
                    changedTags.add(tag);
                }
            });
            const metricKeys = Object.keys(existingRecord.metricValues);
            metricKeys.forEach((metricKey) => {
                const metric = this._metrics.get(metricKey);
                if (metric != null && metric.hasValueGivenEntryKey(entryKey)) {
                    metric.removeValueGivenEntryKey(entryKey);
                    changedMetrics.add(metric);
                }
            });
            await util_1.PromiseUtil.asyncSequenceGivenArrayAndCallback(Array.from(changedTags), async (tag) => {
                await tag.save();
            });
            await util_1.PromiseUtil.asyncSequenceGivenArrayAndCallback(Array.from(changedMetrics), async (metric) => {
                await metric.save();
            });
            this._db.runQuery(`
      DELETE FROM entries WHERE key = ?
    `, [entryKey]);
        };
        this._readEntry = async (entryKey) => {
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
            result.load();
            this._entryCache.put(entryKey, result);
            return result;
        };
        this._writeEntry = async (entryData, time, entryKey) => {
            if (entryKey == null) {
                entryKey = node_crypto_1.UniqueId.ofRandom().toUUIDString();
            }
            if (entryKey.length < 5) {
                throw new Error("Entry key length must be at least 5 characters");
            }
            let entry = await this._readEntry(entryKey);
            const tagKeys = this.props.tagKeysGivenEntryData(entryData);
            const metricValues = this.props.metricsGivenEntryData(entryData);
            if (entry == null) {
                entry = new Entry_1.Entry({
                    key: entryKey,
                    db: this._db,
                    createdAt: time,
                    updatedAt: time,
                });
            }
            else {
                entry.updatedAt = time;
            }
            entry.tagKeys = tagKeys;
            entry.metricValues = metricValues;
            entry.metricValues.createdAt = entry.createdAt.toEpochMilliseconds();
            entry.data = entryData;
            entry.save();
            this._entryCache.put(entryKey, entry);
            this._allEntryKeys.add(entryKey);
            const changedTags = new Set();
            const changedMetrics = new Set();
            entry.tagKeys.forEach((tagKey) => {
                let tag = this._tags.get(tagKey);
                if (tag == null) {
                    tag = new Tag_1.Tag({
                        tagKey,
                        db: this._db,
                    });
                    this._tags.set(tagKey, tag);
                }
                if (!tag.entryKeys.has(entryKey)) {
                    tag.entryKeys.add(entryKey);
                    changedTags.add(tag);
                }
            });
            const metricKeys = Object.keys(entry.metricValues);
            metricKeys.forEach((metricKey) => {
                let metric = this._metrics.get(metricKey);
                if (metric == null) {
                    metric = new Metric_1.Metric({
                        metricKey,
                        db: this._db,
                    });
                    this._metrics.set(metricKey, metric);
                }
                const metricValue = entry.metricValues[metricKey];
                if (metric.toOptionalValueGivenEntryKey(entryKey) !== metricValue) {
                    metric.setEntryMetricValue(entryKey, metricValue);
                    changedMetrics.add(metric);
                }
            });
            await util_1.PromiseUtil.asyncSequenceGivenArrayAndCallback(Array.from(changedTags), async (tag) => {
                await tag.save();
            });
            await util_1.PromiseUtil.asyncSequenceGivenArrayAndCallback(Array.from(changedMetrics), async (metric) => {
                await metric.save();
            });
            return entry;
        };
        this._listRecordKeys = async (options = {}) => {
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
                    return tag.entryKeys;
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
                    const metricValue = metric.toOptionalValueGivenEntryKey(entryKey);
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
        };
        this._listRecords = async (options = {}) => {
            const entryKeys = await this._listRecordKeys(options);
            const entries = [];
            await util_1.PromiseUtil.asyncSequenceGivenArrayAndCallback(entryKeys, async (entryKey) => {
                const result = await this._readEntry(entryKey);
                if (result != null) {
                    entries.push(result);
                }
            });
            return entries;
        };
        this._nextInstruction = async () => {
            const instruction = this._instructions.shift();
            if (instruction == null) {
                return;
            }
            try {
                switch (instruction.type) {
                    case "write":
                        const writeResult = await this._writeEntry(instruction.data, instruction.time, instruction.key);
                        instruction.resolve(writeResult);
                        break;
                    case "read":
                        const readResult = await this._readEntry(instruction.key);
                        instruction.resolve(readResult);
                        break;
                    case "delete":
                        await this._deleteEntry(instruction.key);
                        instruction.resolve();
                        break;
                    case "listEntryKeys":
                        const listKeysResult = await this._listRecordKeys(instruction.options);
                        instruction.resolve(listKeysResult);
                        break;
                    case "listEntries":
                        const listRowsResult = await this._listRecords(instruction.options);
                        instruction.resolve(listRowsResult);
                        break;
                }
            }
            catch (err) {
                instruction.reject(err);
            }
            if (this._instructions.length > 0) {
                setTimeout(this._nextInstruction, 1);
            }
        };
        this._entryCache = new LRUCache_1.LRUCache(props.cacheSize || 10);
    }
    onActivate() {
        this._db = this.addActor(new SqlClient_1.SqlClient({
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
        data TEXT NOT NULL
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS tagEntries (
        tagKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        FOREIGN KEY(tagKey) REFERENCES tags(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
      )
    `);
        db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue INTEGER NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
      )
    `);
        const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);
        const entryKeys = db
            .toRows("SELECT key FROM entries")
            .map((row) => row.key);
        const metricKeys = db
            .toRows("SELECT key FROM metrics")
            .map((row) => row.key);
        tagKeys.forEach((tagKey) => {
            const tag = new Tag_1.Tag({
                tagKey,
                db: this._db,
            });
            tag.load();
            this._tags.set(tagKey, tag);
            this._tagPrefixes.add(tag.tagPrefix);
        });
        metricKeys.forEach((metricKey) => {
            const metric = new Metric_1.Metric({
                metricKey,
                db: this._db,
            });
            metric.load();
            this._metrics.set(metricKey, metric);
        });
        this._allEntryKeys = new Set(entryKeys);
    }
    async toEntryKeys(options = {}) {
        return new Promise((resolve, reject) => {
            const instruction = {
                type: "listEntryKeys",
                options,
                resolve,
                reject,
            };
            this._instructions.push(instruction);
            if (this._instructions.length === 1) {
                this._nextInstruction();
            }
        });
    }
    async hasEntry(entryKey) {
        const keys = await this.toEntryKeys();
        return keys.includes(entryKey);
    }
    async toEntryCount(requireTagKeys) {
        const keys = await this.toEntryKeys({
            requireTagKeys: requireTagKeys,
        });
        return keys.length;
    }
    async toEntries(options = {}) {
        return new Promise((resolve, reject) => {
            const instruction = {
                type: "listEntries",
                options,
                resolve,
                reject,
            };
            this._instructions.push(instruction);
            if (this._instructions.length === 1) {
                this._nextInstruction();
            }
        });
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
    toOptionalEntryGivenKey(entryKey) {
        return new Promise((resolve, reject) => {
            const instruction = {
                type: "read",
                key: entryKey,
                resolve,
                reject,
            };
            this._instructions.push(instruction);
            if (this._instructions.length === 1) {
                this._nextInstruction();
            }
        });
    }
    writeEntry(entryData, entryKey) {
        return new Promise((resolve, reject) => {
            const instruction = {
                type: "write",
                time: time_1.Instant.ofNow(),
                key: entryKey,
                data: entryData,
                resolve,
                reject,
            };
            this._instructions.push(instruction);
            if (this._instructions.length === 1) {
                this._nextInstruction();
            }
        });
    }
    deleteEntryKey(entryKey) {
        return new Promise((resolve, reject) => {
            const instruction = {
                type: "delete",
                key: entryKey,
                resolve,
                reject,
            };
            this._instructions.push(instruction);
            if (this._instructions.length === 1) {
                this._nextInstruction();
            }
        });
    }
}
exports.ObjectDb = ObjectDb;
//# sourceMappingURL=index.js.map