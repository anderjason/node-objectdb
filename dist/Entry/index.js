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
        this.status = "unknown";
    }
    load() {
        var _a;
        const row = this.props.db.toFirstRow("SELECT data, propertyValues, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
        if (row == null) {
            this.status = "new";
            return false;
        }
        this.data = JSON.parse(row.data);
        this.propertyValues = JSON.parse((_a = row.propertyValues) !== null && _a !== void 0 ? _a : "{}");
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAt);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAt);
        this.status = "saved";
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
        const propertyValues = JSON.stringify(this.propertyValues);
        this.props.db.runQuery(`
      INSERT INTO entries (key, data, propertyValues, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, propertyValues=?, createdAt=?, updatedAt=?;
      `, [
            this.key,
            data,
            propertyValues,
            createdAtMs,
            updatedAtMs,
            data,
            propertyValues,
            createdAtMs,
            updatedAtMs,
        ]);
        this.status = "saved";
    }
    toPortableEntry() {
        var _a;
        return {
            key: this.key,
            createdAtEpochMs: this.createdAt.toEpochMilliseconds(),
            updatedAtEpochMs: this.updatedAt.toEpochMilliseconds(),
            data: this.data,
            propertyValues: (_a = this.propertyValues) !== null && _a !== void 0 ? _a : {},
            status: this.status,
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map