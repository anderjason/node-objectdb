import { Bucket, PortableBucket } from "../../Bucket";
export declare class MaterializedBucket<T> extends Bucket<T> {
    private _entryKeys;
    onActivate(): void;
    toEntryKeys(): Promise<Set<string>>;
    hasEntryKey(entryKey: string): Promise<boolean>;
    addEntryKey(entryKey: string): void;
    deleteEntryKey(entryKey: string): void;
    save(): Promise<void>;
    toPortableObject(): PortableBucket;
}
