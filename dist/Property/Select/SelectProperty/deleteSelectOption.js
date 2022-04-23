"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSelectOptionValues = void 0;
async function deleteSelectOptionValues(db, propertyKey, optionKey) {
    const fullPropertyPath = `propertyValues.${propertyKey}`;
    await db.collection("entries").updateMany({ [fullPropertyPath]: optionKey }, { $unset: { [fullPropertyPath]: 1 } });
}
exports.deleteSelectOptionValues = deleteSelectOptionValues;
//# sourceMappingURL=deleteSelectOption.js.map