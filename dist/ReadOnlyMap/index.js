"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyMap = void 0;
class ReadOnlyMap {
    constructor(map) {
        this._map = map;
    }
    get size() {
        return this._map.size;
    }
    has(key) {
        return this._map.has(key);
    }
    get(key) {
        return this._map.get(key);
    }
    keys() {
        return this._map.keys();
    }
    values() {
        return this._map.values();
    }
    entries() {
        return this._map.entries();
    }
    forEach(fn) {
        this._map.forEach(fn);
    }
}
exports.ReadOnlyMap = ReadOnlyMap;
//# sourceMappingURL=index.js.map