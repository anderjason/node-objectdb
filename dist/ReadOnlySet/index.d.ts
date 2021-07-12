export declare class ReadOnlySet<T> {
    private _set;
    constructor(set: Set<T>);
    get size(): number;
    has(value: T): boolean;
    values(): IterableIterator<T>;
    forEach(fn: (value: T, value2: T, set: Set<T>) => void): void;
}
