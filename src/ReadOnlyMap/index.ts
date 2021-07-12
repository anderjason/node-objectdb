export class ReadOnlyMap<TK, TV> {
  private _map: Map<TK, TV>;

  constructor(map: Map<TK, TV>) {
    this._map = map;
  }

  get size(): number {
    return this._map.size;
  }

  has(key: TK): boolean {
    return this._map.has(key);
  }

  get(key: TK): TV {
    return this._map.get(key);
  }

  keys(): IterableIterator<TK> {
    return this._map.keys();
  }

  values(): IterableIterator<TV> {
    return this._map.values();
  }

  entries(): IterableIterator<[TK, TV]> {
    return this._map.entries();
  }

  forEach(fn: (value: TV, key: TK, map: Map<TK, TV>) => void): void {
    this._map.forEach(fn);
  }
}