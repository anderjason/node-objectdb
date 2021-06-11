import { Actor } from "skytree";
import { Metric } from "../Metric";
import { Tag } from "../Tag";
import { Entry } from "../Entry";
import { Dict } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";
export interface ObjectDbReadOptions {
    requireTagKeys?: string[];
    orderByMetricKey?: string;
    limit?: number;
    offset?: number;
}
export interface ObjectDbProps<T> {
    localFile: LocalFile;
    tagKeysGivenEntryData: (data: T) => string[];
    metricsGivenEntryData: (data: T) => Dict<number>;
    cacheSize?: number;
}
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    private _entryCache;
    private _tagPrefixes;
    private _tags;
    private _metrics;
    private _allEntryKeys;
    private _db;
    constructor(props: ObjectDbProps<T>);
    onActivate(): void;
    get tags(): Tag[];
    get metrics(): Metric[];
    get tagPrefixes(): string[];
    private load;
    toEntryKeys(options?: ObjectDbReadOptions): string[];
    hasEntry(entryKey: string): boolean;
    toEntryCount(requireTagKeys?: string[]): number;
    toEntries(options?: ObjectDbReadOptions): Entry<T>[];
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Entry<T> | undefined;
    toEntryGivenKey(entryKey: string): Entry<T>;
    toOptionalEntryGivenKey(entryKey: string): Entry<T> | undefined;
    writeEntry(entry: Entry<T>): Entry<T>;
    writeEntryData(entryData: T, entryKey?: string): Entry<T>;
    deleteEntryKey(entryKey: string): void;
}
