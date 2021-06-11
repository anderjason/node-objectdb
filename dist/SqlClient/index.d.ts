import { Actor } from "skytree";
import BetterSqlite3 from "better-sqlite3";
import { LocalFile } from "@anderjason/node-filesystem";
export interface Sqlite3ActorProps {
    localFile: LocalFile;
}
export declare class DbInstance extends Actor<Sqlite3ActorProps> {
    private _db;
    get connection(): BetterSqlite3.Database;
    onActivate(): void;
    runQuery(sql: string, params?: any[]): void;
    runTransaction(fn: () => void): void;
    toRows(sql: string, params?: any[]): any[];
    toFirstRow(sql: string, params?: any[]): any;
}
