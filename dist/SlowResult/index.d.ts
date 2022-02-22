import { ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { Actor } from "skytree";
export interface SlowResultProps<TO, TI = any> {
    fn: (item: TI) => Promise<TO | undefined>;
    label?: string;
    getItems?: () => AsyncGenerator<TI>;
    getTotalCount?: () => Promise<number>;
}
export declare type SlowResultStatus = "busy" | "done" | "error";
export declare class SlowResult<TO, TI = any> extends Actor<SlowResultProps<TO, TI>> {
    readonly key: string;
    private _status;
    readonly status: ReadOnlyObservable<SlowResultStatus>;
    readonly foundResult: TypedEvent<TO>;
    readonly error: TypedEvent<string>;
    private _processedCount;
    get processedCount(): number;
    private _totalCount;
    get totalCount(): number | undefined;
    private _results;
    get results(): TO[];
    private _errors;
    get errors(): string[];
    get label(): string;
    onActivate(): void;
    private run;
}
