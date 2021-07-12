"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
const skytree_1 = require("skytree");
const ReadOnlySet_1 = require("../ReadOnlySet");
class Tag extends skytree_1.Actor {
    constructor(props) {
        super(props);
        if (props.tagKey == null) {
            throw new Error("tagKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        if (!props.tagKey.includes(":")) {
            throw new Error(`Tags must be in the form PREFIX:VALUE (got '${props.tagKey}')`);
        }
        this.key = props.tagKey;
        const parts = props.tagKey.split(":");
        this.tagPrefix = parts[0];
        this.tagValue = parts[1];
        const { db } = this.props;
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
        db.prepareCached("INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)").run(this.key, this.tagPrefix, this.tagValue);
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
    addValue(value) {
        this.loadOnce();
        this.props.stopwatch.start("tag:addValue");
        this._insertEntryKeyQuery.run(this.key, value);
        this._entryKeys.add(value);
        this.props.stopwatch.stop("tag:addValue");
    }
    deleteValue(value) {
        this.loadOnce();
        this._entryKeys.delete(value);
        this._deleteEntryKeyQuery.run(this.key, value);
    }
}
exports.Tag = Tag;
//# sourceMappingURL=index.js.map