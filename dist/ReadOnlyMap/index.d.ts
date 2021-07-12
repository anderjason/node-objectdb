export declare class ReadOnlyMap<TK, TV> {
    private _map;
    constructor(map: Map<TK, TV>);
    get size(): number;
    has(key: TK): boolean;
    get(key: TK): TV;
    keys(): IterableIterator<TK>;
    values(): IterableIterator<TV>;
    entries(): IterableIterator<[TK, TV]>;
    forEach(fn: (value: TV, key: TK, map: Map<TK, TV>) => void): void;
}
