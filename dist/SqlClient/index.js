"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbInstance = void 0;
const skytree_1 = require("skytree");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const observable_1 = require("@anderjason/observable");
class DbInstance extends skytree_1.Actor {
    constructor() {
        super(...arguments);
        this._preparedStatements = new Map();
    }
    get connection() {
        return this._db;
    }
    onActivate() {
        this._db = better_sqlite3_1.default(this.props.localFile.toAbsolutePath(), {});
        // https://phiresky.github.io/blog/2020/sqlite-performance-tuning/
        this._db.pragma("journal_mode = WAL");
        this._db.pragma("synchronous = normal");
        this._db.pragma("temp_store = memory");
        this._db.pragma("mmap_size = 30000000000");
        this._db.pragma("encoding = 'UTF-8'");
        this._db.pragma("optimize");
        this.cancelOnDeactivate(new observable_1.Receipt(() => {
            this._db.pragma("optimize");
            this._db.close();
            this._db = undefined;
        }));
        this._db.prepare;
    }
    prepareCached(sql) {
        if (!this._preparedStatements.has(sql)) {
            this._preparedStatements.set(sql, this._db.prepare(sql));
        }
        return this._preparedStatements.get(sql);
    }
    runQuery(sql, params = []) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        this.prepareCached(sql).run(params);
    }
    runTransaction(fn) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        this._db.transaction(fn)();
    }
    toRows(sql, params = []) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        return this.prepareCached(sql).all(params);
    }
    toFirstRow(sql, params = []) {
        const rows = this.toRows(sql, params);
        return rows[0];
    }
}
exports.DbInstance = DbInstance;
//# sourceMappingURL=index.js.map