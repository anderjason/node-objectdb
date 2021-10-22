"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bucket = exports.isAbsoluteBucketIdentifier = void 0;
const observable_1 = require("@anderjason/observable");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
function isAbsoluteBucketIdentifier(identifier) {
    return "dimensionKey" in identifier;
}
exports.isAbsoluteBucketIdentifier = isAbsoluteBucketIdentifier;
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
//# sourceMappingURL=index.js.map