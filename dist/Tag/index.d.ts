import { PropsObject } from "../PropsObject";
import { SqlClient } from "../SqlClient";
export interface TagProps {
    tagKey: string;
    db: SqlClient;
}
export declare class Tag extends PropsObject<TagProps> {
    readonly tagPrefix: string;
    readonly tagValue: string;
    readonly key: string;
    entryKeys: Set<string>;
    constructor(props: TagProps);
    load(): void;
    save(): void;
}
