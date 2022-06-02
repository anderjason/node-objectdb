"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entry = void 0;
const node_crypto_1 = require("@anderjason/node-crypto");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const Metric_1 = require("../Metric");
class Entry extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.key = props.key || node_crypto_1.UniqueId.ofRandom().toUUIDString();
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt || props.createdAt;
        this.status = "unknown";
    }
    async load() {
        const metric = new Metric_1.Metric("Entry.load");
        const row = await this.props.db
            .collection("entries")
            .findOne({ key: this.key });
        if (row == null) {
            this.status = "new";
            return new Metric_1.MetricResult(metric, false);
        }
        this.data = row.data;
        this.propertyValues = row.propertyValues;
        this.createdAt = time_1.Instant.givenEpochMilliseconds(row.createdAtEpochMs);
        this.updatedAt = time_1.Instant.givenEpochMilliseconds(row.updatedAtEpochMs);
        this.status = "saved";
        this.documentVersion = row.documentVersion;
        return new Metric_1.MetricResult(metric, true);
    }
    async save() {
        var _a;
        const metric = new Metric_1.Metric("Entry.save");
        this.updatedAt = time_1.Instant.ofNow();
        if (this.createdAt == null) {
            this.createdAt = this.updatedAt;
        }
        const createdAtMs = this.createdAt.toEpochMilliseconds();
        const updatedAtMs = this.updatedAt.toEpochMilliseconds();
        const newDocumentVersion = this.documentVersion == null ? 1 : this.documentVersion + 1;
        const result = await this.props.db
            .collection("entries")
            .updateOne({ key: this.key, documentVersion: this.documentVersion }, {
            $set: {
                key: this.key,
                createdAtEpochMs: createdAtMs,
                updatedAtEpochMs: updatedAtMs,
                data: this.data,
                propertyValues: (_a = this.propertyValues) !== null && _a !== void 0 ? _a : {},
                status: this.status,
                documentVersion: newDocumentVersion,
            },
        }, { upsert: true });
        if (result.modifiedCount == 0 && result.upsertedCount == 0) {
            throw new Error("Failed to save entry - could be a document version mismatch");
        }
        this.status = "saved";
        return new Metric_1.MetricResult(metric, undefined);
    }
    toClone() {
        const result = new Entry({
            key: this.key,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            db: this.props.db,
            objectDb: this.props.objectDb,
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
            createdAtEpochMs: this.createdAt != null
                ? this.createdAt.toEpochMilliseconds()
                : undefined,
            updatedAtEpochMs: this.updatedAt != null
                ? this.updatedAt.toEpochMilliseconds()
                : undefined,
            data: this.data,
            propertyValues: (_a = this.propertyValues) !== null && _a !== void 0 ? _a : {},
            status: this.status,
            documentVersion: this.documentVersion,
        };
    }
}
exports.Entry = Entry;
//# sourceMappingURL=index.js.map