import { Actor } from "skytree";
import BetterSqlite3, { Statement } from "better-sqlite3";
import { Receipt } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";

export interface Sqlite3ActorProps {
  localFile: LocalFile;
}

export class DbInstance extends Actor<Sqlite3ActorProps> {
  private _db: BetterSqlite3.Database;
  private _preparedStatements = new Map<string, Statement>();

  get connection(): BetterSqlite3.Database {
    return this._db;
  }

  onActivate() {
    this.props.localFile.toDirectory().createDirectorySync();
    
    this._db = BetterSqlite3(this.props.localFile.toAbsolutePath(), {});

    this._db.pragma("encoding = 'UTF-8'");
    
    this.cancelOnDeactivate(
      new Receipt(() => {
        this._db.pragma("optimize");
        this._db.close();
        console.log("Closed database", this.props.localFile.toAbsolutePath());
        this._db = undefined;
      })
    );

    this._db.prepare;
  }

  prepareCached(sql: string): Statement {
    if (!this._preparedStatements.has(sql)) {
      this._preparedStatements.set(sql, this._db.prepare(sql));
    }

    return this._preparedStatements.get(sql);
  }

  runQuery(sql: string, params: any[] = []): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    }

    this.prepareCached(sql).run(params);
  }

  runTransaction(fn: () => void): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    } 

    this._db.transaction(fn)();
  }

  toRows(sql: string, params: any[] = []): any[] {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    }

    return this.prepareCached(sql).all(params);
  }

  toFirstRow(sql: string, params: any[] = []): any {
    const rows = this.toRows(sql, params);
    return rows[0];
  }
}
