import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PortableEntry } from "../ObjectDb/Types";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";
export interface EntryProps<T> {
    key?: string;
    createdAt?: Instant;
    updatedAt?: Instant;
    db: DbInstance;
}
export declare class Entry<T> extends PropsObject<EntryProps<T>> {
    readonly key: string;
    createdAt: Instant;
    updatedAt: Instant;
    data: T;
    tagKeys: string[];
    metricValues: Dict<number>;
    constructor(props: EntryProps<T>);
    load(): boolean;
    save(): void;
    toPortableObject(): PortableEntry;
}
