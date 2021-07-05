import { ObservableSet } from "@anderjason/observable";
import { Actor } from "skytree";
import { DbInstance } from "../SqlClient";
export interface TagProps {
    tagKey: string;
    db: DbInstance;
}
export declare class Tag extends Actor<TagProps> {
    readonly tagPrefix: string;
    readonly tagValue: string;
    readonly key: string;
    private _entryKeys;
    private _insertEntryKeyQuery;
    private _deleteEntryKeyQuery;
    get entryKeys(): ObservableSet<string>;
    constructor(props: TagProps);
    onActivate(): void;
    private loadEntryKeysOnce;
}
