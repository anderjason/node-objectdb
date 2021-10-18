"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDb = void 0;
const observable_1 = require("@anderjason/observable");
const mongodb_1 = require("mongodb");
const skytree_1 = require("skytree");
class MongoDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this._isConnected = observable_1.Observable.givenValue(false);
        this.isConnected = observable_1.ReadOnlyObservable.givenObservable(this._isConnected);
    }
    onActivate() {
        var _a;
        const client = new mongodb_1.MongoClient((_a = this.props.url) !== null && _a !== void 0 ? _a : process.env.MONGODB_URL);
        client.connect().then(() => {
            this._isConnected.setValue(true);
        });
        this._db = client.db(this.props.dbName);
        this.cancelOnDeactivate(new observable_1.Receipt(() => {
            this._isConnected.setValue(false);
            client.close();
            this._db = undefined;
        }));
    }
    async ensureConnected() {
        await this._isConnected.toPromise(v => v == true);
    }
    async dropDatabase() {
        await this._db.dropDatabase();
    }
    collection(name) {
        if (this._db == null) {
            throw new Error("MongoDb is not connected");
        }
        return this._db.collection(`${this.props.namespace}.${name}`);
    }
}
exports.MongoDb = MongoDb;
//# sourceMappingURL=index.js.map