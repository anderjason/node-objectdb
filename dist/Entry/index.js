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
    async load() {
        const row = this.props.db.toFirstRow("SELECT data, createdAt, updatedAt FROM entries WHERE key = ?", [this.key]);
        if (row == null) {
            this.status = "new";
            return false;
        }
        const propertyValues = this.props.db.prepareCached("SELECT propertyKey, propertyValue FROM propertyValues WHERE entryKey = ?").all(this.key);
        this.data = JSON.parse(row.data);
        this.propertyValues = {};
        propertyValues.forEach((row) => {
            this.propertyValues[row.propertyKey] = JSON.parse(row.propertyValue);
        });
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAt);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAt);
        this.status = "saved";
        return true;
    }
    async save() {
        const data = JSON.stringify(this.data);
        this.updatedAt = time_1.Instant.ofNow();
        if (this.createdAt == null) {
            this.createdAt = this.updatedAt;
        }
        const createdAtMs = this.createdAt.toEpochMilliseconds();
        const updatedAtMs = this.updatedAt.toEpochMilliseconds();
        this.props.db.prepareCached(`
      INSERT INTO entries (key, data, createdAt, updatedAt)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(key) 
      DO UPDATE SET data=?, createdAt=?, updatedAt=?;
      `).run([
            this.key,
            data,
            createdAtMs,
            updatedAtMs,
            data,
            createdAtMs,
            updatedAtMs,
        ]);
        this.props.db.prepareCached("DELETE FROM propertyValues WHERE entryKey = ?").run(this.key);
        const insertQuery = this.props.db.prepareCached(`
      INSERT INTO propertyValues (entryKey, propertyKey, propertyValue) 
      VALUES (?, ?, ?)
      ON CONFLICT(entryKey, propertyKey)
      DO UPDATE SET propertyValue=?;
    `);
        const deleteQuery = this.props.db.prepareCached("DELETE FROM propertyValues WHERE entryKey = ? AND propertyKey = ?");
        const properties = await this.props.objectDb.toProperties();
        for (const property of properties) {
            const value = this.propertyValues[property.key];
            if (value != null) {
                const valueStr = JSON.stringify(value);
                insertQuery.run(this.key, property.key, valueStr, valueStr);
            }
            else {
                deleteQuery.run(this.key, property.key);
            }
        }
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