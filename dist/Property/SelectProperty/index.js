"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectProperty = void 0;
const skytree_1 = require("skytree");
const SelectPropertyDimension_1 = require("../../Dimension/SelectPropertyDimension");
const deleteSelectOption_1 = require("./deleteSelectOption");
class SelectProperty extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.definition = props.definition;
    }
    static async writeDefinition(db, definition) {
        const deletedOptions = definition.options.filter((option) => option.isDeleted == true);
        for (const option of deletedOptions) {
            await (0, deleteSelectOption_1.deleteSelectOptionValues)(db, definition.key, option.key);
        }
        definition.options = definition.options.filter(option => option.isDeleted != true);
        await db
            .collection("properties")
            .updateOne({ key: definition.key }, { $set: definition }, { upsert: true });
        return new SelectProperty({ definition });
    }
    async toDimensions() {
        return [
            new SelectPropertyDimension_1.SelectPropertyDimension({
                property: this,
            }),
        ];
    }
}
exports.SelectProperty = SelectProperty;
//# sourceMappingURL=index.js.map