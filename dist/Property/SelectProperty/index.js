"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectProperty = void 0;
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
const __1 = require("../..");
class SelectProperty extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.key = props.definition.key;
        this.propertyType = props.definition.propertyType;
        this.label = props.definition.label;
        this.options = props.definition.options;
    }
    async toDimensions() {
        return [
            __1.LiveDimension.ofEntry({
                dimensionKey: this.key,
                dimensionLabel: this.label,
                valuePath: util_1.ValuePath.givenParts(["propertyValues", this.key]),
                valueType: "single",
            })
        ];
    }
}
exports.SelectProperty = SelectProperty;
//# sourceMappingURL=index.js.map