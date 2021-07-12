"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcast = void 0;
const observable_1 = require("@anderjason/observable");
class Broadcast {
    constructor() {
        this._map = new Map();
    }
    addHandler(key, handler) {
        let set = this._map.get(key);
        if (set == null) {
            set = new Set();
            this._map.set(key, set);
        }
        set.add(handler);
        return new observable_1.Receipt(() => {
            set.delete(handler);
            if (set.size == 0) {
                this._map.delete(key);
            }
        });
    }
    emit(key) {
        const set = this._map.get(key);
        if (set == null) {
            return;
        }
        set.forEach(handler => {
            try {
                handler(key);
            }
            catch (err) {
                console.log(err);
            }
        });
    }
}
exports.Broadcast = Broadcast;
//# sourceMappingURL=index.js.map