"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = exports.hashCodeGivenTagPrefixAndNormalizedValue = exports.normalizedValueGivenString = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const ReadOnlySet_1 = require("../ReadOnlySet");
function normalizedValueGivenString(tagValue) {
    return tagValue.toLowerCase();
}
exports.normalizedValueGivenString = normalizedValueGivenString;
function hashCodeGivenTagPrefixAndNormalizedValue(tagPrefix, normalizedValue) {
    return util_1.StringUtil.hashCodeGivenString(tagPrefix + normalizedValue);
}
exports.hashCodeGivenTagPrefixAndNormalizedValue = hashCodeGivenTagPrefixAndNormalizedValue;
class Tag extends skytree_1.Actor {
    constructor(props) {
        var _a;
        super(props);
        if (props.tagKey == null) {
            throw new Error("tagKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        const normalizedLabel = (_a = props.normalizedLabel) !== null && _a !== void 0 ? _a : normalizedValueGivenString(props.label);
        this.key = props.tagKey;
        this.tagPrefixKey = props.tagPrefixKey;
        this.label = props.label;
        this.normalizedLabel = normalizedLabel;
        const { db } = this.props;
        if (props.normalizedLabel == null) {
            db.prepareCached("UPDATE tags SET normalizedLabel = ? WHERE key = ?").run(normalizedLabel, this.key);
        }
        this.props.stopwatch.start("tag:prepareCached");
        this._insertEntryKeyQuery = db.prepareCached("INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)");
        this._deleteEntryKeyQuery = db.prepareCached("DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?");
        this.props.stopwatch.stop("tag:prepareCached");
    }
    get entryKeys() {
        this.loadOnce();
        if (this._readOnlyEntryKeys == null) {
            this._readOnlyEntryKeys = new ReadOnlySet_1.ReadOnlySet(this._entryKeys);
        }
        return this._readOnlyEntryKeys;
    }
    loadOnce() {
        if (this._entryKeys != null) {
            return;
        }
        this.props.stopwatch.start("tag:loadOnce");
        const { db } = this.props;
        this.props.stopwatch.start("tag:insertIntoTags");
        db.prepareCached("INSERT OR IGNORE INTO tags (key, tagPrefixKey, label, normalizedLabel) VALUES (?, ?, ?, ?)").run(this.key, this.tagPrefixKey, this.label, this.normalizedLabel);
        this.props.stopwatch.stop("tag:insertIntoTags");
        this.props.stopwatch.start("tag:selectEntryKeys");
        const rows = db
            .prepareCached("SELECT entryKey FROM tagEntries WHERE tagKey = ?")
            .all(this.key);
        this.props.stopwatch.stop("tag:selectEntryKeys");
        this.props.stopwatch.start("tag:createSet");
        this._entryKeys = new Set(rows.map((row) => row.entryKey));
        this.props.stopwatch.stop("tag:createSet");
        this.props.stopwatch.stop("tag:loadOnce");
    }
    addEntryKey(entryKey) {
        this.loadOnce();
        this.props.stopwatch.start("tag:addValue");
        this._insertEntryKeyQuery.run(this.key, entryKey);
        this._entryKeys.add(entryKey);
        this.props.stopwatch.stop("tag:addValue");
    }
    deleteEntryKey(entryKey) {
        this.loadOnce();
        this._entryKeys.delete(entryKey);
        this._deleteEntryKeyQuery.run(this.key, entryKey);
    }
    toHashCode() {
        return hashCodeGivenTagPrefixAndNormalizedValue(this.tagPrefixKey, this.normalizedLabel);
    }
}
exports.Tag = Tag;
//# sourceMappingURL=index.js.map