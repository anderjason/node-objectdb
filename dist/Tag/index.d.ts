import { Actor } from "skytree";
import { ReadOnlySet } from "../ReadOnlySet";
import { DbInstance } from "../SqlClient";
export interface TagProps {
    tagKey: string;
    db: DbInstance;
}
export declare class Tag extends Actor<TagProps> {
    readonly tagPrefix: string;
    readonly tagValue: string;
    readonly key: string;
    get entryKeys(): ReadOnlySet<string>;
    private _entryKeys;
    private _readOnlyEntryKeys;
    private _insertEntryKeyQuery;
    private _deleteEntryKeyQuery;
    constructor(props: TagProps);
    private loadOnce;
    addValue(value: string): void;
    deleteValue(value: string): void;
}
