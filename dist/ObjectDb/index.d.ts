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
    private _instructions;
    private _db;
    constructor(props: ObjectDbProps<T>);
    onActivate(): void;
    get tags(): Tag[];
    get metrics(): Metric[];
    get tagPrefixes(): string[];
    private load;
    toEntryKeys(options?: ObjectDbReadOptions): Promise<string[]>;
    hasEntry(entryKey: string): Promise<boolean>;
    toEntryCount(requireTagKeys?: string[]): Promise<number>;
    toEntries(options?: ObjectDbReadOptions): Promise<Entry<T>[]>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<Entry<T> | undefined>;
    toEntryGivenKey(entryKey: string): Promise<Entry<T>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined>;
    writeEntry(entryData: T, entryKey?: string): Promise<Entry<T>>;
    deleteEntryKey(entryKey: string): Promise<void>;
    private _deleteEntry;
    private _readEntry;
    private _writeEntry;
    private _listRecordKeys;
    private _listRecords;
    private _nextInstruction;
}
