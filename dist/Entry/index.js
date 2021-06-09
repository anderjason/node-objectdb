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
    }
    load() {
        const row = this.props.db.toFirstRow("SELECT data FROM entries WHERE key = ?", [this.key]);
        if (row == null) {
            return;
        }
        const portableEntry = JSON.parse(row.data);
        this.data = portableEntry.data;
        this.createdAt = time_1.Instant.givenEpochMilliseconds(portableEntry.createdAtMs);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(portableEntry.updatedAtMs);
        this.tagKeys = portableEntry.tagKeys || [];
        this.metricValues = portableEntry.metricValues || {};
    }
    save() {
        const data = JSON.stringify(this.toPortableObject());
        this.props.db.runQuery(`
      INSERT INTO entries (key, data)
      VALUES(?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?;
      `, [this.key, data, data]);
    }
    toPortableObject() {
        return {
            key: this.key,
            tagKeys: this.tagKeys || [],
            metricValues: this.metricValues || {},
            createdAtMs: this.createdAt.toEpochMilliseconds(),
            updatedAtMs: this.updatedAt.toEpochMilliseconds(),
            data: this.data,
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map