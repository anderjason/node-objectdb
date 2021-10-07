"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dimension = void 0;
const skytree_1 = require("skytree");
const ReadOnlyMap_1 = require("../ReadOnlyMap");
class Dimension extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this._buckets = new Map();
        this.buckets = new ReadOnlyMap_1.ReadOnlyMap(this._buckets);
    }
    onActivate() {
        this.cancelOnDeactivate(this.props.objectDb.entryDidChange.subscribe((change) => {
        }));
    }
}
exports.Dimension = Dimension;
//# sourceMappingURL=index.js.map