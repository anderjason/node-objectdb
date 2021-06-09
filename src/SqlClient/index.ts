import { Actor } from "skytree";
import BetterSqlite3 from 'better-sqlite3';
import { Receipt } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";

export interface SqlClientProps {
  localFile: LocalFile;
}

export class SqlClient extends Actor<SqlClientProps> {
  private _db: BetterSqlite3.Database;
  
  onActivate() {
    this._db = BetterSqlite3(this.props.localFile.toAbsolutePath(), {});
    
    this.cancelOnDeactivate(
      new Receipt(() => {
        this._db.close();
        this._db = undefined;
      })
    );
  }

  runTransaction(fn: () => void): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    } 

    this._db.transaction(fn);
  }

  runQuery(sql: string, params: any[] = []): void {
    if (this._db == null) {
      throw new Error("Sql is not activated");
    }

    this._db.prepare(sql).run(params);
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