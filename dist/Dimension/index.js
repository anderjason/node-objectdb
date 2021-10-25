"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashCodeGivenBucketIdentifier = void 0;
const util_1 = require("@anderjason/util");
function hashCodeGivenBucketIdentifier(bucketIdentifier) {
    const key = this.props.dimension.key + this.props.identifier.bucketKey;
    return util_1.StringUtil.hashCodeGivenString(key);
}
exports.hashCodeGivenBucketIdentifier = hashCodeGivenBucketIdentifier;
//# sourceMappingURL=index.js.map