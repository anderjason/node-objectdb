import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PortableEntry } from "../ObjectDb/Types";
import { PropsObject } from "../PropsObject";
import { SqlClient } from "../SqlClient";
export interface EntryProps<T> {
    key?: string;
    createdAt?: Instant;
    updatedAt?: Instant;
    db: SqlClient;
}
export declare class Entry<T> extends PropsObject<EntryProps<T>> {
    readonly key: string;
    createdAt: Instant;
    updatedAt: Instant;
    data: T;
    tagKeys: string[];
    metricValues: Dict<number>;
    constructor(props: EntryProps<T>);
    load(): void;
    save(): void;
    toPortableObject(): PortableEntry;
}
