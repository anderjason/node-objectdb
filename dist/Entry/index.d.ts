import { Dict } from "@anderjason/observable";
import { Instant } from "@anderjason/time";
import { PropsObject } from "../PropsObject";
import { DbInstance } from "../SqlClient";
export declare type EntryStatus = "unknown" | "new" | "saved" | "updated" | "deleted";
declare type JSONSerializable = string | number | boolean | null | JSONSerializable[] | {
    [key: string]: JSONSerializable;
};
export interface PortableEntry<T> {
    key: string;
    createdAtEpochMs: number;
    updatedAtEpochMs: number;
    data: T;
    propertyValues: Dict<JSONSerializable>;
    status: EntryStatus;
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
    propertyValues: Map<string, JSONSerializable>;
    status: EntryStatus;
    constructor(props: EntryProps<T>);
    load(): boolean;
    save(): void;
    toPortableEntry(): PortableEntry<T>;
}
export {};
