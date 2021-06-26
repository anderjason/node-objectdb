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
    readonly entryKeys: ObservableSet<string>;
    private _insertEntryKeyQuery;
    private _deleteEntryKeyQuery;
    private _dbId;
    constructor(props: TagProps);
    onActivate(): void;
}
