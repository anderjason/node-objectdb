"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoFilterOfEntryString = void 0;
function mongoFilterOfEntryString(propertyName) {
    const fullPropertyName = `data.${propertyName}`;
    return (bucketIdentifier) => {
        return {
            [fullPropertyName]: bucketIdentifier.bucketKey,
        };
    };
}
exports.mongoFilterOfEntryString = mongoFilterOfEntryString;
//# sourceMappingURL=mongoFilterOfEntry.js.map