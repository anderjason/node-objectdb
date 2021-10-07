import { Actor } from "skytree";
import { ObjectDb } from "..";
import { ReadOnlyMap } from "../ReadOnlyMap";
import { Bucket } from "./Bucket";
export interface DimensionProps<T> {
    key: string;
    label: string;
    objectDb: ObjectDb<T>;
}
export declare class Dimension<T> extends Actor<DimensionProps<T>> {
    private _buckets;
    readonly buckets: ReadOnlyMap<string, Bucket>;
    onActivate(): void;
}
