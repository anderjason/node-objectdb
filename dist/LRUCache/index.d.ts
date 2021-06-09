/**
 * @module wireframe.backend.sdk
 * @author Jason Anderson
 * @copyright 2016-2020 Jason Anderson
 * @license See vendor/wireframe/LICENSE file
 */
export declare class LRUCache<T> {
    readonly limit: number;
    private _size;
    private _keymap;
    private _head;
    private _tail;
    constructor(limit: number);
    get: (key: string) => T | undefined;
    put: (key: string, value: T) => void;
    remove: (key: string) => void;
    private removeOldestEntry;
    private getEntry;
}
