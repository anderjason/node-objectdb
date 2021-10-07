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
export declare type TagLookup = string | PortableTag;
export interface ObjectDbReadOptions {
    requireTags?: TagLookup[];
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
    toEntryKeys(options?: ObjectDbReadOptions): Promise<string[]>;
    forEach(fn: (entry: Entry<T>) => Promise<void>): Promise<void>;
    hasEntry(entryKey: string): Promise<boolean>;
    runTransaction(fn: () => Promise<void>): Promise<void>;
    toEntryCount(requireTags?: TagLookup[]): Promise<number>;
    toEntries(options?: ObjectDbReadOptions): Promise<Entry<T>[]>;
    toOptionalFirstEntry(options?: ObjectDbReadOptions): Promise<Entry<T> | undefined>;
    toEntryGivenKey(entryKey: string): Promise<Entry<T>>;
    toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined>;
    setProperty(property: PropertyDefinition): Promise<void>;
    deletePropertyKey(key: string): Promise<void>;
    toPropertyGivenKey(key: string): Promise<PropertyDefinition>;
    toProperties(): Promise<PropertyDefinition[]>;
    removeMetadataGivenEntryKey(entryKey: string): Promise<void>;
    rebuildMetadata(): Promise<void>;
    toTagPrefixGivenLabel(tagPrefixLabel: string, createIfMissing: boolean): Promise<TagPrefix>;
    private tagGivenPropertyKeyAndValue;
    propertyTagKeysGivenEntry(entry: Entry<T>): Promise<PortableTag[]>;
    rebuildMetadataGivenEntry(entry: Entry<T>): Promise<void>;
    writeEntry(entry: Entry<T> | PortableEntry<T>): Promise<void>;
    toOptionalTagGivenLookup(lookup: TagLookup): Promise<Tag | undefined>;
    private toTagGivenPortableTag;
    metricGivenMetricKey(metricKey: string): Promise<Metric>;
    writeEntryData(entryData: T, propertyValues?: Dict<JSONSerializable>, entryKey?: string, createdAt?: Instant): Promise<Entry<T>>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
export {};
