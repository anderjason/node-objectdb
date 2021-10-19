"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterializedBucket = exports.MaterializedDimension = exports.Dimension = exports.Bucket = void 0;
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
function isAbsoluteBucketIdentifier(identifier) {
    return "dimensionKey" in identifier;
}
class Bucket extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this.didChange = new observable_1.TypedEvent();
        this.key = props.identifier.bucketKey;
        this.label = props.identifier.bucketLabel;
    }
    onActivate() { }
    toAbsoluteIdentifier() {
        return Object.assign({ dimensionKey: this.props.dimension.key }, this.props.identifier);
    }
    toHashCode() {
        const key = this.props.dimension.key + this.props.identifier.bucketKey;
        return util_1.StringUtil.hashCodeGivenString(key);
    }
}
exports.Bucket = Bucket;
class Dimension extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this._buckets = new Map();
        this._isUpdated = observable_1.Observable.givenValue(false, observable_1.Observable.isStrictEqual);
        this.isUpdated = observable_1.ReadOnlyObservable.givenObservable(this._isUpdated);
        this.key = props.key;
        this.label = props.label;
        this._saveLater = new time_1.Debounce({
            duration: time_1.Duration.givenSeconds(15),
            fn: async () => {
                try {
                    await this.save();
                }
                catch (err) {
                    console.error(`An error occurred in Dimension.saveLater: ${err}`);
                }
            },
        });
    }
    onActivate() {
        this._isUpdated.setValue(false);
        this.cancelOnDeactivate(new observable_1.Receipt(() => {
            this._saveLater.clear();
        }));
    }
    async save() {
        const data = this.toPortableObject();
        if (this.db.isConnected.value == false) {
            console.error("Cannot save dimension because MongoDb is not connected");
            return;
        }
        await this.db.collection("dimensions").updateOne({ key: this.props.key }, {
            $set: Object.assign({}, data),
        }, { upsert: true });
        for (const bucket of this._buckets.values()) {
            await bucket.save();
        }
        this._saveLater.clear();
    }
    toOptionalBucketGivenKey(key) {
        return this._buckets.get(key);
    }
    toBuckets() {
        return this._buckets.values();
    }
    addBucket(bucket) {
        this.addActor(bucket);
        this._buckets.set(bucket.props.identifier.bucketKey, bucket);
        this.cancelOnDeactivate(bucket.didChange.subscribe(() => {
            this._saveLater.invoke();
        }));
    }
    toPortableObject() {
        return {
            type: this.constructor.name,
        };
    }
}
exports.Dimension = Dimension;
class MaterializedDimension extends Dimension {
    constructor() {
        super(...arguments);
        this._bucketsByEntryKey = new Map();
        this._waitingForEntryKeys = new Set();
    }
    onActivate() {
        super.onActivate();
        this.cancelOnDeactivate(this.objectDb.entryDidChange.subscribe(async (change) => {
            this.entryDidChange(change.key);
        }));
    }
    async load() {
        // const row = await this.db.collection<any>("dimensions").findOne({ key: this.props.key });
        const bucketRows = await this.db.collection("buckets").find({ "identifier.dimensionKey": this.props.key }).toArray();
        for (const bucketRow of bucketRows) {
            const bucket = new MaterializedBucket({
                identifier: bucketRow.identifier,
                storage: bucketRow.storage,
                dimension: this,
            });
            this.addBucket(bucket);
        }
        this._isUpdated.setValue(true);
    }
    async entryDidChange(entryKey) {
        this._isUpdated.setValue(false);
        this._waitingForEntryKeys.add(entryKey);
        const entry = await this.objectDb.toOptionalEntryGivenKey(entryKey);
        if (entry == null) {
            await this.deleteEntryKey(entryKey);
        }
        else {
            await this.rebuildEntry(entry);
        }
        this._waitingForEntryKeys.delete(entryKey);
        if (this._waitingForEntryKeys.size === 0) {
            this._isUpdated.setValue(true);
        }
    }
    async deleteEntryKey(entryKey) {
        for (const bucket of this._buckets.values()) {
            bucket.deleteEntryKey(entryKey);
        }
    }
    async rebuildEntry(entry) {
        var _a;
        let bucketIdentifiers = (_a = this.props.bucketIdentifiersGivenEntry(entry)) !== null && _a !== void 0 ? _a : [];
        bucketIdentifiers = bucketIdentifiers.filter((bi) => bi != null);
        for (const bucketIdentifier of bucketIdentifiers) {
            if (isAbsoluteBucketIdentifier(bucketIdentifier)) {
                if (bucketIdentifier.dimensionKey !== this.props.key) {
                    throw new Error(`Received an absolute bucket identifier for a different dimension (expected {${this.props.key}}, got {${bucketIdentifier.dimensionKey}})`);
                }
            }
            // create the bucket if necessary
            if (!this._buckets.has(bucketIdentifier.bucketKey)) {
                const bucket = new MaterializedBucket({
                    identifier: bucketIdentifier,
                    dimension: this,
                });
                this.addBucket(bucket);
            }
            const bucket = this._buckets.get(bucketIdentifier.bucketKey);
            bucket.addEntryKey(entry.key);
        }
        const bucketKeys = new Set(bucketIdentifiers.map((bi) => bi.bucketKey));
        for (const bucket of this._buckets.values()) {
            if (!bucketKeys.has(bucket.props.identifier.bucketKey)) {
                bucket.deleteEntryKey(entry.key);
            }
        }
    }
    async rebuild() {
        await this.objectDb.forEach(async (entry) => {
            await this.rebuildEntry(entry);
        });
        this.save();
    }
}
exports.MaterializedDimension = MaterializedDimension;
class MaterializedBucket extends Bucket {
    constructor() {
        super(...arguments);
        this._entryKeys = new Set();
    }
    onActivate() {
        this._entryKeys.clear();
        const storage = this.props.storage;
        if (storage != null && storage.entryKeys != null) {
            this._entryKeys.clear();
            for (const entryKey of storage.entryKeys) {
                this._entryKeys.add(entryKey);
            }
        }
    }
    async toEntryKeys() {
        return new Set(this._entryKeys);
    }
    async hasEntryKey(entryKey) {
        return this._entryKeys.has(entryKey);
    }
    addEntryKey(entryKey) {
        if (this._entryKeys.has(entryKey)) {
            return;
        }
        this._entryKeys.add(entryKey);
        this.didChange.emit();
    }
    deleteEntryKey(entryKey) {
        if (!this._entryKeys.has(entryKey)) {
            return;
        }
        this._entryKeys.delete(entryKey);
        this.didChange.emit();
    }
    async save() {
        const data = this.toPortableObject();
        if (this.props.dimension.db.isConnected.value == false) {
            console.error("Cannot save bucket because MongoDb is not connected");
            return;
        }
        await this.props.dimension.db.collection("buckets").updateOne({ key: this.props.identifier.bucketKey }, {
            $set: Object.assign({}, data),
        }, { upsert: true });
    }
    toPortableObject() {
        return {
            type: "MaterializedBucket",
            identifier: this.toAbsoluteIdentifier(),
            storage: {
                entryKeys: Array.from(this._entryKeys),
            },
        };
    }
}
exports.MaterializedBucket = MaterializedBucket;
//# sourceMappingURL=index.js.map