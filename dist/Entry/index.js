"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entry = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
class Entry extends skytree_1.PropsObject {
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
        this.propertyValues = row.propertyValues;
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAtEpochMs);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAtEpochMs);
        this.status = "saved";
        this.documentVersion = row.documentVersion;
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
        const newDocumentVersion = this.documentVersion == null ? 1 : this.documentVersion + 1;
        const result = await this.props.db.collection("entries").updateOne({ key: this.key, documentVersion: this.documentVersion }, {
            $set: {
                key: this.key,
                createdAtEpochMs: createdAtMs,
                updatedAtEpochMs: updatedAtMs,
                data: this.data,
                propertyValues: (_a = this.propertyValues) !== null && _a !== void 0 ? _a : {},
                status: this.status,
                documentVersion: newDocumentVersion
            },
        }, { upsert: true });
        if (result.modifiedCount == 0 && result.upsertedCount == 0) {
            throw new Error("Failed to save entry - could be a document version mismatch");
        }
        this.status = "saved";
    }
    toClone() {
        const result = new Entry({
            key: this.key,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            db: this.props.db,
            objectDb: this.props.objectDb
        });
        result.data = util_1.ObjectUtil.objectWithDeepMerge({}, this.data);
        result.propertyValues = util_1.ObjectUtil.objectWithDeepMerge({}, this.propertyValues);
        result.status = this.status;
        result.documentVersion = this.documentVersion;
        return result;
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
            documentVersion: this.documentVersion
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map