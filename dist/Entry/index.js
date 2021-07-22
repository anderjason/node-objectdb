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
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt || props.createdAt;
    }
    load() {
        const row = this.props.db.toFirstRow("SELECT data, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
        if (row == null) {
            return false;
        }
        this.data = JSON.parse(row.data);
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAt);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAt);
        return true;
    }
    save() {
        const data = JSON.stringify(this.data);
        this.updatedAt = time_1.Instant.ofNow();
        if (this.createdAt == null) {
            this.createdAt = this.updatedAt;
        }
        const createdAtMs = this.createdAt.toEpochMilliseconds();
        const updatedAtMs = this.updatedAt.toEpochMilliseconds();
        this.props.db.runQuery(`
      INSERT INTO entries (key, data, createdAt, updatedAt)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, createdAt=?, updatedAt=?;
      `, [this.key, data, createdAtMs, updatedAtMs, data, createdAtMs, updatedAtMs]);
    }
    toPortableEntry() {
        return {
            key: this.key,
            createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
            updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
            data: this.data
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map