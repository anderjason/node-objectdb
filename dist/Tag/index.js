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
        this._insertEntryKeyQuery = db.prepareCached("INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)");
        this._deleteEntryKeyQuery = db.prepareCached("DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?");
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
        const { db } = this.props;
        db.prepareCached("INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)").run(this.key, this.tagPrefix, this.tagValue);
        const rows = db
            .prepareCached("SELECT entryKey FROM tagEntries WHERE tagKey = ?")
            .all(this.key);
        this._entryKeys = new Set(rows.map((row) => row.entryKey));
    }
    addValue(value) {
        this.loadOnce();
        this._insertEntryKeyQuery.run(this.key, value);
        this._entryKeys.add(value);
    }
    deleteValue(value) {
        this.loadOnce();
        this._entryKeys.delete(value);
        this._deleteEntryKeyQuery.run(this.key, value);
    }
}
exports.Tag = Tag;
//# sourceMappingURL=index.js.map