import { Stopwatch } from "@anderjason/time";
import { Actor } from "skytree";
import { DbInstance } from "../SqlClient";
export interface TagPrefixProps {
    tagPrefixKey: string;
    label: string;
    db: DbInstance;
    stopwatch: Stopwatch;
    normalizedLabel?: string;
}
export declare function normalizedValueGivenString(tagValue: string): string;
export declare class TagPrefix extends Actor<TagPrefixProps> {
    readonly key: string;
    readonly label: string;
    readonly normalizedLabel: string;
    constructor(props: TagPrefixProps);
    onActivate(): void;
    private loadOnce;
}
