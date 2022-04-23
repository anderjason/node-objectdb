"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashCodeGivenBucketIdentifier = void 0;
const util_1 = require("@anderjason/util");
function hashCodeGivenBucketIdentifier(bucketIdentifier) {
    const key = bucketIdentifier.dimensionKey + bucketIdentifier.bucketKey;
    return util_1.StringUtil.hashCodeGivenString(key);
}
exports.hashCodeGivenBucketIdentifier = hashCodeGivenBucketIdentifier;
//# sourceMappingURL=index.js.map