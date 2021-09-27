import { Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";
import { TagPrefix } from "../TagPrefix";
export interface TagProps {
    tagKey: string;
    tagPrefix: TagPrefix;
    label: string;
    db: DbInstance;
    stopwatch: Stopwatch;
    normalizedLabel?: string;
}
export declare function normalizedValueGivenString(tagValue: string): string;
export declare function hashCodeGivenTagPrefixAndNormalizedValue(tagPrefix: string, normalizedValue: string): number;
export declare class Tag extends Actor<TagProps> {
    readonly key: string;
    readonly tagPrefix: TagPrefix;
    readonly label: string;
    readonly normalizedLabel: string;
    get entryKeys(): ReadOnlySet<string>;
    private _entryKeys;
    private _readOnlyEntryKeys;
    private _insertEntryKeyQuery;
    private _deleteEntryKeyQuery;
    constructor(props: TagProps);
    private loadOnce;
    addEntryKey(entryKey: string): void;
    deleteEntryKey(entryKey: string): void;
    toHashCode(): number;
}
