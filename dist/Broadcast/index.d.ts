import { Receipt } from "@anderjason/observable";
export declare type BroadcastHandler = (key: string) => void;
export declare class Broadcast {
    private _map;
    addHandler(key: string, handler: BroadcastHandler): Receipt;
    emit(key: string): void;
}
