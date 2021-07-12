"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlySet = void 0;
class ReadOnlySet {
    constructor(set) {
        this._set = set;
    }
    get size() {
        return this._set.size;
    }
    has(value) {
        return this._set.has(value);
    }
    values() {
        return this._set.values();
    }
    forEach(fn) {
        this._set.forEach(fn);
    }
}
exports.ReadOnlySet = ReadOnlySet;
//# sourceMappingURL=index.js.map