import { ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { PropsObject } from "skytree";
export interface SlowResultProps<TO, TI = any> {
    getItems: () => AsyncGenerator<TI>;
    fn: (item: TI) => Promise<TO | undefined>;
}
export declare type SlowResultStatus = "busy" | "done" | "error";
export declare class SlowResult<TO, TI = any> extends PropsObject<SlowResultProps<TO, TI>> {
    readonly key: string;
    private _status;
    readonly status: ReadOnlyObservable<SlowResultStatus>;
    readonly foundResult: TypedEvent<TO>;
    readonly error: TypedEvent<string>;
    private _results;
    get results(): TO[];
    private _errors;
    get errors(): string[];
    get totalCount(): number | undefined;
    constructor(props: SlowResultProps<TO, TI>);
    private run;
}
