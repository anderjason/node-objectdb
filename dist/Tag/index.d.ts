import { Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";
export interface TagProps {
    tagKey: string;
    tagPrefix: string;
    tagValue: string;
    db: DbInstance;
    stopwatch: Stopwatch;
    tagNormalizedValue?: string;
}
export declare function normalizedValueGivenString(tagValue: string): string;
export declare function hashCodeGivenTagPrefixAndNormalizedValue(tagPrefix: string, normalizedValue: string): number;
export declare class Tag extends Actor<TagProps> {
    readonly key: string;
    readonly tagPrefix: string;
    readonly tagValue: string;
    readonly tagNormalizedValue: string;
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
