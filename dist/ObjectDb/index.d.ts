import { LocalFile } from "@anderjason/node-filesystem";
import { Dict, TypedEvent } from "@anderjason/observable";
import { Instant, Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { Entry, JSONSerializable, PortableEntry } from "../Entry";
import { Metric } from "../Metric";
import { Tag } from "../Tag";
import { PortableTag } from "../Tag/PortableTag";
import { TagPrefix } from "../TagPrefix";
export interface Order {
    key: string;
    direction: "ascending" | "descending";
}
export interface ObjectDbReadOptions {
    requireTagKeys?: string[];
    orderByMetric?: Order;
    limit?: number;
    offset?: number;
    cacheKey?: string;
}
export interface ObjectDbProps<T> {
    localFile: LocalFile;
    tagsGivenEntry: (entry: Entry<T>) => PortableTag[];
    metricsGivenEntry: (entry: Entry<T>) => Dict<string>;
    cacheSize?: number;
}
export interface EntryChange<T> {
    key: string;
    oldData?: T;
    newData?: T;
}
interface BasePropertyDefinition {
    key: string;
    label: string;
    listOrder: number;
}
export interface SelectPropertyOption {
    key: string;
    label: string;
}
export interface SelectPropertyDefinition extends BasePropertyDefinition {
    type: "select";
    options: SelectPropertyOption[];
}
export declare type PropertyDefinition = SelectPropertyDefinition;
export declare class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
    readonly collectionDidChange: TypedEvent<void>;
    readonly entryWillChange: TypedEvent<EntryChange<T>>;
    readonly entryDidChange: TypedEvent<EntryChange<T>>;
    readonly stopwatch: Stopwatch;
    private _tagPrefixesByKey;
    private _tagPrefixesByNormalizedLabel;
    private _tagsByKey;
    private _tagsByHashcode;
    private _metrics;
    private _properties;
    private _entryKeys;
    private _caches;
    private _db;
    constructor(props: ObjectDbProps<T>);
    onActivate(): void;
    get tags(): Tag[];
    get metrics(): Metric[];
    get tagPrefixes(): TagPrefix[];
    private load;
    toEntryKeys(options?: ObjectDbReadOptions): string[];
    forEach(fn: (entry: Entry<T>) => void): void;
    hasEntry(entryKey: string): boolean;
    runTransaction(fn: () => void): void;
    toEntryCount(requireTagKeys?: string[]): number;
    toEntries(options?: ObjectDbReadOptions): Entry<T>[];
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Entry<T> | undefined;
    toEntryGivenKey(entryKey: string): Entry<T>;
    toOptionalEntryGivenKey(entryKey: string): Entry<T> | undefined;
    setProperty(property: PropertyDefinition): void;
    deletePropertyKey(key: string): void;
    toPropertyGivenKey(key: string): PropertyDefinition;
    toProperties(): PropertyDefinition[];
    private saveProperties;
    removeMetadataGivenEntryKey(entryKey: string): void;
    rebuildMetadata(): void;
    toTagPrefixGivenLabel(tagPrefixLabel: string, createIfMissing: boolean): TagPrefix;
    private tagGivenPropertyKeyAndValue;
    propertyTagKeysGivenEntry(entry: Entry<T>): PortableTag[];
    rebuildMetadataGivenEntry(entry: Entry<T>): void;
    writeEntry(entry: Entry<T> | PortableEntry<T>): void;
    toTagGivenPortableTag(portableTag: PortableTag, createIfMissing?: boolean): Tag;
    metricGivenMetricKey(metricKey: string): Metric;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant): Entry<T>;
    deleteEntryKey(entryKey: string): void;
}
export {};
