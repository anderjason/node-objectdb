"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlClient = void 0;
const skytree_1 = require("skytree");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const observable_1 = require("@anderjason/observable");
class SqlClient extends skytree_1.Actor {
    onActivate() {
        this._db = better_sqlite3_1.default(this.props.localFile.toAbsolutePath(), {});
        this.cancelOnDeactivate(new observable_1.Receipt(() => {
            this._db.close();
            this._db = undefined;
        }));
    }
    runTransaction(fn) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        this._db.transaction(fn);
    }
    runQuery(sql, params = []) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        this._db.prepare(sql).run(params);
    }
    toRows(sql, params = []) {
        if (this._db == null) {
            throw new Error("Sql is not activated");
        }
        return this._db.prepare(sql).all(params);
    }
    toFirstRow(sql, params = []) {
        const rows = this.toRows(sql, params);
        return rows[0];
    }
}
exports.SqlClient = SqlClient;
//# sourceMappingURL=index.js.map