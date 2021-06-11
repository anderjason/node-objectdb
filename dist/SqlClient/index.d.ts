import { Actor } from "skytree";
import BetterSqlite3, { Statement } from "better-sqlite3";
import { LocalFile } from "@anderjason/node-filesystem";
export interface Sqlite3ActorProps {
    localFile: LocalFile;
}
export declare class DbInstance extends Actor<Sqlite3ActorProps> {
    private _db;
    private _preparedStatements;
    get connection(): BetterSqlite3.Database;
    onActivate(): void;
    prepareCached(sql: string): Statement;
    runQuery(sql: string, params?: any[]): void;
    runTransaction(fn: () => void): void;
    toRows(sql: string, params?: any[]): any[];
    toFirstRow(sql: string, params?: any[]): any;
}
