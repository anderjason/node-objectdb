export class ReadOnlySet<T> {
  private _set: Set<T>;

  constructor(set: Set<T>) {
    this._set = set;
  }

  get size(): number {
    return this._set.size;
  }

  has(value: T): boolean {
    return this._set.has(value);
  }

  values(): IterableIterator<T> {
    return this._set.values();
  }

  forEach(fn: (value: T, value2: T, set: Set<T>) => void): void {
    this._set.forEach(fn);
  }
}