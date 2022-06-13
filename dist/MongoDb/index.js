"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDb = void 0;
const node_filesystem_1 = require("@anderjason/node-filesystem");
const observable_1 = require("@anderjason/observable");
const mongodb_1 = require("mongodb");
const skytree_1 = require("skytree");
class MongoDb extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this._isConnected = observable_1.Observable.givenValue(false);
        this.isConnected = observable_1.ReadOnlyObservable.givenObservable(this._isConnected);
    }
    get client() {
        if (this._db == null) {
            throw new Error("DB is not set");
        }
        return this._db;
    }
    onActivate() {
        this._isConnected.setValue(false);
        this.cancelOnDeactivate(new observable_1.Receipt(() => {
            this._isConnected.setValue(false);
            if (this._mongoClient != null) {
                this._mongoClient.close();
                this._mongoClient = undefined;
            }
            this._db = undefined;
        }));
        this.connect();
    }
    async connect() {
        var _a;
        let cert = undefined;
        if (process.env.MONGODB_CERT) {
            cert = process.env.MONGODB_CERT;
        }
        else if (this.props.certPath != null) {
            const file = node_filesystem_1.LocalFile.givenAbsolutePath(this.props.certPath);
            cert = await file.toContentString();
        }
        const url = (_a = this.props.url) !== null && _a !== void 0 ? _a : process.env.MONGODB_URL;
        if (url == null) {
            throw new Error("MongoDb url is not set");
        }
        const client = new mongodb_1.MongoClient(url, {
            cert,
            tlsAllowInvalidCertificates: true,
            keepAlive: true,
            retryWrites: true,
            retryReads: true,
        });
        this._db = client.db(this.props.dbName);
        client.connect().then(() => {
            this._isConnected.setValue(true);
        });
        client.addListener("close", () => {
            console.log("Detected disconnection in MongoDb/index.ts");
            this._isConnected.setValue(false);
        });
    }
    async ensureConnected() {
        await this._isConnected.toPromise((v) => v == true);
    }
    async dropDatabase() {
        if (this._db == null) {
            throw new Error("Internal db is missing in MongoDb.dropDatabase");
        }
        await this._db.dropDatabase();
    }
    collection(name) {
        if (this._db == null) {
            throw new Error("MongoDb is not connected");
        }
        if (this.props.namespace != null) {
            return this._db.collection(`${this.props.namespace}.${name}`);
        }
        else {
            return this._db.collection(name);
        }
    }
}
exports.MongoDb = MongoDb;
//# sourceMappingURL=index.js.map