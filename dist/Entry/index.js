"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entry = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const time_1 = require("@anderjason/time");
const PropsObject_1 = require("../PropsObject");
class Entry extends PropsObject_1.PropsObject {
    constructor(props) {
        super(props);
        this.key = props.key || node_crypto_1.UniqueId.ofRandom().toUUIDString();
        this.createdAt = props.createdAt || time_1.Instant.ofNow();
        this.updatedAt = props.updatedAt || props.createdAt || time_1.Instant.ofNow();
        this.label = props.label;
    }
    load() {
        const row = this.props.db.toFirstRow("SELECT data, label, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
        if (row == null) {
            return false;
        }
        this.data = JSON.parse(row.data);
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAt);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAt);
        this.label = row.label;
        return true;
    }
    save() {
        const data = JSON.stringify(this.data);
        const createdAtMs = this.createdAt.toEpochMilliseconds();
        const updatedAtMs = this.updatedAt.toEpochMilliseconds();
        this.props.db.runQuery(`
      INSERT INTO entries (key, data, label, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, label=?, createdAt=?, updatedAt=?;
      `, [this.key, data, this.label, createdAtMs, updatedAtMs, data, this.label, createdAtMs, updatedAtMs]);
    }
    toPortableEntry() {
        return {
            key: this.key,
            createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
            updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
            data: this.data,
            label: this.label
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map