"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlowResult = void 0;
const observable_1 = require("@anderjason/observable");
const util_1 = require("@anderjason/util");
const skytree_1 = require("skytree");
class SlowResult extends skytree_1.PropsObject {
    constructor(props) {
        super(props);
        this.key = util_1.StringUtil.stringOfRandomCharacters(8);
        this._status = observable_1.Observable.givenValue("busy");
        this.status = observable_1.ReadOnlyObservable.givenObservable(this._status);
        this.foundResult = new observable_1.TypedEvent();
        this.error = new observable_1.TypedEvent();
        this._results = [];
        this._errors = [];
        this.run();
    }
    get results() {
        return this._results;
    }
    get errors() {
        return this._errors;
    }
    get totalCount() {
        return undefined;
    }
    async run() {
        var e_1, _a;
        this._status.setValue("busy");
        this._results = [];
        try {
            for (var _b = __asyncValues(this.props.getItems()), _c; _c = await _b.next(), !_c.done;) {
                const item = _c.value;
                try {
                    const output = await this.props.fn(item);
                    if (output != null) {
                        this._results.push(output);
                        this.foundResult.emit(output);
                    }
                }
                catch (err) {
                    const error = String(err);
                    this._errors.push(error);
                    this.error.emit(error);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        this._status.setValue("done");
    }
}
exports.SlowResult = SlowResult;
//# sourceMappingURL=index.js.map