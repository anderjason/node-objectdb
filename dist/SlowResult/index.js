"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
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
function defaultGetItems() {
    return __asyncGenerator(this, arguments, function* defaultGetItems_1() {
        yield yield __await(undefined);
    });
}
class SlowResult extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this.key = util_1.StringUtil.stringOfRandomCharacters(8);
        this._status = observable_1.Observable.givenValue("busy");
        this.status = observable_1.ReadOnlyObservable.givenObservable(this._status);
        this.foundResult = new observable_1.TypedEvent();
        this.error = new observable_1.TypedEvent();
        this._processedCount = 0;
        this._results = [];
        this._errors = [];
    }
    get processedCount() {
        return this._processedCount;
    }
    get totalCount() {
        return this._totalCount;
    }
    get results() {
        return this._results;
    }
    get errors() {
        return this._errors;
    }
    onActivate() {
        setTimeout(() => {
            this.run();
        }, 1);
    }
    async run() {
        var e_1, _a;
        this._status.setValue("busy");
        this._results = [];
        this._processedCount = 0;
        if (this.props.getTotalCount != null) {
            this._totalCount = await this.props.getTotalCount();
        }
        let items = this.props.getItems != null
            ? this.props.getItems()
            : defaultGetItems();
        try {
            for (var items_1 = __asyncValues(items), items_1_1; items_1_1 = await items_1.next(), !items_1_1.done;) {
                const item = items_1_1.value;
                if (this.isActive == false) {
                    // cancelled
                    break;
                }
                try {
                    const output = await this.props.fn(item);
                    // @ts-ignore
                    if (this.isActive == false) {
                        // cancelled
                        break;
                    }
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
                this._processedCount += 1;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (items_1_1 && !items_1_1.done && (_a = items_1.return)) await _a.call(items_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        this._status.setValue("done");
    }
}
exports.SlowResult = SlowResult;
//# sourceMappingURL=index.js.map