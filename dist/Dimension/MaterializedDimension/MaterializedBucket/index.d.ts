import { Bucket } from "../../Bucket";
export declare class MaterializedBucket<T> extends Bucket<T> {
    toEntryKeys(): Promise<Set<string>>;
    hasEntryKey(entryKey: string): Promise<boolean>;
    addEntryKey(entryKey: string): Promise<void>;
    deleteEntryKey(entryKey: string): Promise<void>;
}
