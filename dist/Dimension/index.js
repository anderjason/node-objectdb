"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dimension = void 0;
const observable_1 = require("@anderjason/observable");
const time_1 = require("@anderjason/time");
const skytree_1 = require("skytree");
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
//# sourceMappingURL=index.js.map