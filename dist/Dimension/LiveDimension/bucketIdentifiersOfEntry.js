"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bucketIdentifiersOfEntryString = void 0;
function bucketIdentifiersOfEntryString(params) {
    const fullPropertyName = `data.${params.propertyName}`;
    return async (db) => {
        const messages = await db
            .collection("entries")
            .find({
            [fullPropertyName]: { $exists: true },
        }, { projection: { _id: 0, [fullPropertyName]: 1 } })
            .toArray();
        return messages.map((m) => {
            var _a;
            const key = m.data[params.propertyName];
            const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;
            return {
                dimensionKey: (_a = params.dimensionKey) !== null && _a !== void 0 ? _a : params.propertyName,
                bucketKey: key,
                bucketLabel: label
            };
        });
    };
}
exports.bucketIdentifiersOfEntryString = bucketIdentifiersOfEntryString;
//# sourceMappingURL=bucketIdentifiersOfEntry.js.map