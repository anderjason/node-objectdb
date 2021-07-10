import { LocalFile } from "@anderjason/node-filesystem";
import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { Actor } from "skytree";
import { Entry } from "../Entry";
import { Metric } from "../Metric";
import { Tag } from "../Tag";
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
    labelGivenEntryData: (data: T) => string;
    cacheSize?: number;
}
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    private _entryCache;
    private _tagPrefixes;
    private _tags;
    private _metrics;
    private _entryReferences;
    private _db;
    constructor(props: ObjectDbProps<T>);
    onActivate(): void;
    get tags(): Tag[];
    get metrics(): Metric[];
    get tagPrefixes(): string[];
    private load;
    toEntryKeys(options?: ObjectDbReadOptions): string[];
    hasEntry(entryKey: string): boolean;
    runTransaction(fn: () => void): void;
    toEntryCount(requireTagKeys?: string[]): number;
    toEntries(options?: ObjectDbReadOptions): Entry<T>[];
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Entry<T> | undefined;
    toEntryGivenKey(entryKey: string): Entry<T>;
    toOptionalEntryGivenKey(entryKey: string): Entry<T> | undefined;
    removeMetadataGivenEntryKey(entryKey: string): void;
    rebuildMetadata(): void;
    rebuildMetadataGivenEntry(entry: Entry<T>): void;
    writeEntry(entry: Entry<T>): Entry<T>;
    tagGivenTagKey(tagKey: string): Tag;
    metricGivenMetricKey(metricKey: string): Metric;
    writeEntryData(entryData: T, entryKey?: string, createdAt?: Instant): Entry<T>;
    deleteEntryKey(entryKey: string): void;
}
