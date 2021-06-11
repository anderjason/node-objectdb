import { Actor } from "skytree";
import BetterSqlite3, { Statement } from "better-sqlite3";
import { Receipt } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";

export interface Sqlite3ActorProps {
  localFile: LocalFile;
}

export class DbInstance extends Actor<Sqlite3ActorProps> {
  private _db: BetterSqlite3.Database;

  get connection(): BetterSqlite3.Database {
    return this._db;
  }

  onActivate() {
    this._db = BetterSqlite3(this.props.localFile.toAbsolutePath(), {});

    this.cancelOnDeactivate(
      new Receipt(() => {
        this._db.close();
        this._db = undefined;
      })
    );

    this._db.prepare;
  }

  runQuery(sql: string, params: any[] = []): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    }

    this._db.prepare(sql).run(params);
  }

  runTransaction(fn: () => void): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    } 

    this._db.transaction(fn);
  }

  toRows(sql: string, params: any[] = []): any[] {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    }

    return this._db.prepare(sql).all(params);
  }

  toFirstRow(sql: string, params: any[] = []): any {
    const rows = this.toRows(sql, params);
    return rows[0];
  }
}
