"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectProperty = void 0;
const skytree_1 = require("skytree");
const SelectPropertyDimension_1 = require("../../Dimension/SelectPropertyDimension");
class SelectProperty extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.definition = props.definition;
    }
    async toDimensions() {
        return [
            new SelectPropertyDimension_1.SelectPropertyDimension({
                property: this
            })
        ];
    }
}
exports.SelectProperty = SelectProperty;
//# sourceMappingURL=index.js.map