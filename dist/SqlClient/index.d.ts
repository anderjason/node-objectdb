import { Actor } from "skytree";
import { LocalFile } from "@anderjason/node-filesystem";
export interface SqlClientProps {
    localFile: LocalFile;
}
export declare class SqlClient extends Actor<SqlClientProps> {
    private _db;
    onActivate(): void;
    runTransaction(fn: () => void): void;
    runQuery(sql: string, params?: any[]): void;
    toRows(sql: string, params?: any[]): any[];
    toFirstRow(sql: string, params?: any[]): any;
}
