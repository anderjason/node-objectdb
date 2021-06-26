import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";
export interface PortableEntry<T> {
    key: string;
    createdAtEpochMs: number;
    updatedAtEpochMs: number;
    data: T;
}
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
    constructor(props: EntryProps<T>);
    load(): boolean;
    save(): void;
    toPortableEntry(): PortableEntry<T>;
}
