"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyGivenDefinition = void 0;
const SelectProperty_1 = require("./SelectProperty");
function propertyGivenDefinition(definition) {
    switch (definition.propertyType) {
        case "select":
            return new SelectProperty_1.SelectProperty({ definition });
        default:
            throw new Error(`Unsupported property type: ${definition.propertyType}`);
    }
}
exports.propertyGivenDefinition = propertyGivenDefinition;
//# sourceMappingURL=index.js.map