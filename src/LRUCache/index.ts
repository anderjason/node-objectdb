export class LRUCache<TK, TV> {
  readonly capacity: number;

  private _map = new Map<TK, TV>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  clear(): void {
    this._map.clear();
  }
  
  get(key: TK): TV {
    if (this._map.has(key)) {
      const value = this._map.get(key);
      this._map.delete(key);
      this._map.set(key, value);
      return value;
    }

    return undefined;
  }

  put(key: TK, value: TV): void {
    if (this._map.has(key)) {
      this._map.delete(key);
    }

    this._map.set(key, value);

    if (this._map.size > this.capacity) {
      this._map.delete(this._map.keys().next().value);  // delete first
    }
  }
}
