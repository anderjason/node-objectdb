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
        const row = await this.props.db.collection("entries").findOne({ key: this.key });
        if (row == null) {
            this.status = "new";
            return false;
        }
        this.data = row.data;
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAtEpochMs);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAtEpochMs);
        this.status = "saved";
        return true;
    }
    async save() {
        var _a;
        this.updatedAt = time_1.Instant.ofNow();
        if (this.createdAt == null) {
            this.createdAt = this.updatedAt;
        }
        const createdAtMs = this.createdAt.toEpochMilliseconds();
        const updatedAtMs = this.updatedAt.toEpochMilliseconds();
        await this.props.db.collection("entries").updateOne({ key: this.key }, {
            $set: {
                key: this.key,
                createdAtEpochMs: createdAtMs,
                updatedAtEpochMs: updatedAtMs,
                data: this.data,
                propertyValues: (_a = this.propertyValues) !== null && _a !== void 0 ? _a : {},
                status: this.status,
            },
        }, { upsert: true });
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