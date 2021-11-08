"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlowResults = void 0;
const observable_1 = require("@anderjason/observable");
const skytree_1 = require("skytree");
class SlowResults extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this._processedCount = observable_1.Observable.ofEmpty();
        this.processedCount = observable_1.ReadOnlyObservable.givenObservable(this._processedCount);
        this.didFinish = new observable_1.TypedEvent();
        this.foundResult = new observable_1.TypedEvent();
        this._results = [];
        this.run();
    }
    async run() {
        var e_1, _a;
        this._processedCount.setValue(0);
        this._results = [];
        try {
            for (var _b = __asyncValues(this.props.getItems()), _c; _c = await _b.next(), !_c.done;) {
                const item = _c.value;
                const output = await this.props.fn(item);
                if (output != null) {
                    this._results.push(output);
                    this.foundResult.emit(output);
                }
                this._processedCount.setValue(this._processedCount.value + 1);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        this.didFinish.emit(this._results);
    }
}
exports.SlowResults = SlowResults;
//# sourceMappingURL=index.js.map