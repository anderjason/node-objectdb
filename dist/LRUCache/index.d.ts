export declare class LRUCache<TK, TV> {
    readonly capacity: number;
    private _map;
    constructor(capacity: number);
    clear(): void;
    get(key: TK): TV;
    put(key: TK, value: TV): void;
}
