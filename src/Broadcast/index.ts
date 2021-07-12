import { Receipt } from "@anderjason/observable";

export type BroadcastHandler = (key: string) => void;

export class Broadcast {
  private _map = new Map<string, Set<BroadcastHandler>>();

  addHandler(key: string, handler: BroadcastHandler): Receipt {
    let set = this._map.get(key);
    if (set == null) {
      set = new Set();
      this._map.set(key, set);
    }

    set.add(handler);

    return new Receipt(() => {
      set.delete(handler);
      if (set.size == 0) {
        this._map.delete(key);
      }
    });
  }

  emit(key: string): void {
    const set = this._map.get(key);
    if (set == null) {
      return;
    }

    set.forEach(handler => {
      try {
        handler(key);
      } catch (err) {
        console.log(err);
      }
    });
  }
}
