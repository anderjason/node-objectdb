/**
 * @module wireframe.backend.sdk
 * @author Jason Anderson
 * @copyright 2016-2020 Jason Anderson
 * @license See vendor/wireframe/LICENSE file
 */

interface CacheEntry<T> {
  newer?: CacheEntry<T>;
  older?: CacheEntry<T>;
  key: string;
  value: T;
}

export class LRUCache<T> {
  readonly limit: number;

  private _size: number;
  private _keymap = new Map<string, CacheEntry<T>>();
  private _head: CacheEntry<T> | undefined;
  private _tail: CacheEntry<T> | undefined;

  constructor(limit: number) {
    this.limit = limit;
    this._size = 0;
  }

  get = (key: string): T | undefined => {
    const entry = this.getEntry(key);
    if (entry == null) {
      return undefined;
    }

    return entry.value;
  };

  put = (key: string, value: T): void => {
    const entry: CacheEntry<T> = {
      key,
      value,
    };

    this._keymap.set(key, entry);

    if (this._tail != null) {
      this._tail.newer = entry;
      entry.older = this._tail;
    } else {
      this._head = entry;
    }

    this._tail = entry;

    if (this._size === this.limit) {
      this.removeOldestEntry();
    } else {
      this._size += 1;
    }
  };

  remove = (key: string): void => {
    const entry = this._keymap.get(key);

    if (entry == null) {
      return;
    }

    this._keymap.delete(entry.key);

    if (entry.newer != null && entry.older != null) {
      entry.older.newer = entry.newer;
      entry.newer.older = entry.older;
    } else if (entry.newer != null) {
      entry.newer.older = undefined;
      this._head = entry.newer;
    } else if (entry.older != null) {
      entry.older.newer = undefined;
      this._tail = entry.older;
    } else {
      this._head = undefined;
      this._tail = undefined;
    }

    this._size -= 1;
  };

  private removeOldestEntry = (): CacheEntry<T> | undefined => {
    const entry = this._head;

    if (entry != null) {
      if (entry.newer != null) {
        this._head = entry.newer;
        this._head.older = undefined;
      } else {
        this._head = undefined;
      }

      entry.newer = entry.older = undefined;

      this._keymap.delete(entry.key);
    }

    return entry;
  };

  private getEntry = (key: string): CacheEntry<T> | undefined => {
    const entry = this._keymap.get(key);

    if (entry == null) {
      return undefined;
    }

    if (entry === this._tail) {
      return entry;
    }

    if (entry.newer != null) {
      if (entry === this._head) {
        this._head = entry.newer;
      }

      entry.newer.older = entry.older;
    }

    if (entry.older != null) {
      entry.older.newer = entry.newer;
    }

    entry.newer = undefined;
    entry.older = this._tail;

    if (this._tail != null) {
      this._tail.newer = entry;
    }

    this._tail = entry;

    return entry;
  };
}
