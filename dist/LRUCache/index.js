"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
class LRUCache {
    constructor(capacity) {
        this._map = new Map();
        this.capacity = capacity;
    }
    clear() {
        this._map.clear();
    }
    get(key) {
        if (this._map.has(key)) {
            const value = this._map.get(key);
            this._map.delete(key);
            this._map.set(key, value);
            return value;
        }
        return undefined;
    }
    put(key, value) {
        if (this._map.has(key)) {
            this._map.delete(key);
        }
        this._map.set(key, value);
        if (this._map.size > this.capacity) {
            this._map.delete(this._map.keys().next().value); // delete first
        }
    }
}
exports.LRUCache = LRUCache;
//# sourceMappingURL=index.js.map