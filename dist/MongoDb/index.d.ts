import { LocalFile } from "@anderjason/node-filesystem";
import { ReadOnlyObservable } from "@anderjason/observable";
import { Collection, Db } from "mongodb";
import { Actor } from "skytree";
export interface MongoDbProps {
    dbName?: string;
    namespace?: string;
    url?: string;
    certFile?: LocalFile;
}
export declare class MongoDb extends Actor<MongoDbProps> {
    private _isConnected;
    readonly isConnected: ReadOnlyObservable<boolean>;
    private _mongoClient;
    private _db;
    get client(): Db;
    onActivate(): void;
    private connect;
    ensureConnected(): Promise<void>;
    dropDatabase(): Promise<void>;
    collection<T>(name: string): Collection<T>;
}
