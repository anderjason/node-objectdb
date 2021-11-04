"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectProperty = void 0;
const time_1 = require("@anderjason/time");
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
        const property = new SelectProperty({ definition });
        const dimension = property.toSelectPropertyDimension();
        dimension.init(db, new time_1.Stopwatch(""));
        for (const option of deletedOptions) {
            await (0, deleteSelectOption_1.deleteSelectOptionValues)(db, definition.key, option.key);
            await dimension.deleteBucketKey(option.key);
        }
        definition.options = definition.options.filter(option => option.isDeleted != true);
        await db
            .collection("properties")
            .updateOne({ key: definition.key }, { $set: definition }, { upsert: true });
        return property;
    }
    toSelectPropertyDimension() {
        return new SelectPropertyDimension_1.SelectPropertyDimension({
            property: this,
        });
    }
    async toDimensions() {
        return [
            this.toSelectPropertyDimension(),
        ];
    }
}
exports.SelectProperty = SelectProperty;
//# sourceMappingURL=index.js.map