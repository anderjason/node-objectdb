"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dimension = void 0;
const observable_1 = require("@anderjason/observable");
const skytree_1 = require("skytree");
class Dimension extends skytree_1.Actor {
    constructor(props) {
        super(props);
        this._buckets = new Map();
        this._isUpdated = observable_1.Observable.givenValue(true, observable_1.Observable.isStrictEqual);
        this.isUpdated = observable_1.ReadOnlyObservable.givenObservable(this._isUpdated);
        this.key = props.key;
        this.label = props.label;
    }
    onActivate() {
        this._isUpdated.setValue(true);
    }
    async ensureUpdated() {
        if (this._isUpdated.value == true) {
            return;
        }
        console.log(`Waiting for dimension ${this.props.label} to be updated`);
        await this._isUpdated.toPromise(v => v);
        console.log(`Dimension ${this.props.label} is updated`);
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
    }
    toPortableObject() {
        return {
            type: this.constructor.name,
        };
    }
}
exports.Dimension = Dimension;
//# sourceMappingURL=index.js.map