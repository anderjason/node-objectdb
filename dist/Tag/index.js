"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const skytree_1 = require("skytree");
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
    }
    get entryKeys() {
        this.loadEntryKeysOnce();
        return this._entryKeys;
    }
    onActivate() {
    }
    loadEntryKeysOnce() {
        if (this._entryKeys != null) {
            return;
        }
        const { db } = this.props;
        this._insertEntryKeyQuery = db.prepareCached("INSERT INTO tagEntries (tagKey, entryKey) VALUES (?, ?)");
        this._deleteEntryKeyQuery = db.prepareCached("DELETE FROM tagEntries WHERE tagKey = ? AND entryKey = ?");
        db.prepareCached("INSERT OR IGNORE INTO tags (key, tagPrefix, tagValue) VALUES (?, ?, ?)")
            .run(this.key, this.tagPrefix, this.tagValue);
        const start = time_1.Instant.ofNow();
        const rows = db.prepareCached("SELECT entryKey FROM tagEntries WHERE tagKey = ?")
            .all(this.key);
        this._entryKeys = observable_1.ObservableSet.givenValues(rows.map((row) => row.entryKey));
        const finish = time_1.Instant.ofNow();
        const duration = time_1.Duration.givenInstantRange(start, finish);
        console.log(`Loaded tag '${this.key}' (${rows.length}) in ${duration.toSeconds()}s`);
        this.cancelOnDeactivate(this._entryKeys.didChangeSteps.subscribe(steps => {
            steps.forEach(step => {
                switch (step.type) {
                    case "add":
                        this._insertEntryKeyQuery.run(this.key, step.value);
                        break;
                    case "remove":
                        this._deleteEntryKeyQuery.run(this.key, step.value);
                        break;
                    default:
                        break;
                }
            });
        }));
    }
}
exports.Tag = Tag;
//# sourceMappingURL=index.js.map