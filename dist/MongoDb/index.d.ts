import { ReadOnlyObservable } from "@anderjason/observable";
import { Collection } from "mongodb";
import { Actor } from "skytree";
export interface MongoDbProps {
    dbName?: string;
    namespace?: string;
    url?: string;
}
export declare class MongoDb extends Actor<MongoDbProps> {
    private _isConnected;
    readonly isConnected: ReadOnlyObservable<boolean>;
    private _db;
    onActivate(): void;
    ensureConnected(): Promise<void>;
    dropDatabase(): Promise<void>;
    collection<T>(name: string): Collection<T>;
}
