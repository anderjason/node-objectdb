"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectProperty = void 0;
const skytree_1 = require("skytree");
const IsSetDimension_1 = require("../../IsSetDimension");
const SelectDimension_1 = require("../SelectDimension");
const deleteSelectOption_1 = require("./deleteSelectOption");
class SelectProperty extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.definition = props.definition;
    }
    static async writeDefinition(db, definition) {
        const deletedOptions = definition.options.filter((option) => option.isDeleted == true);
        const property = new SelectProperty({ definition });
        const dimension = property.toSelectDimension();
        dimension.init(db);
        for (const option of deletedOptions) {
            await (0, deleteSelectOption_1.deleteSelectOptionValues)(db, definition.key, option.key);
            await dimension.deleteBucketKey(option.key);
        }
        definition.options = definition.options.filter((option) => option.isDeleted != true);
        await db
            .collection("properties")
            .updateOne({ key: definition.key }, { $set: definition }, { upsert: true });
        return property;
    }
    toSelectDimension() {
        return new SelectDimension_1.SelectDimension({
            property: this,
        });
    }
    async toDimensions() {
        return [
            this.toSelectDimension(),
            new IsSetDimension_1.IsSetDimension({
                property: this,
            }),
        ];
    }
}
exports.SelectProperty = SelectProperty;
//# sourceMappingURL=index.js.map