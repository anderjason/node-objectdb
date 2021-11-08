import { ReadOnlyObservable, TypedEvent } from "@anderjason/observable";
import { PropsObject } from "skytree";
export interface SlowResultsProps<TO, TI = any> {
    getItems: () => AsyncGenerator<TI>;
    fn: (item: TI) => Promise<TO | undefined>;
}
export declare class SlowResults<TO, TI = any> extends PropsObject<SlowResultsProps<TO, TI>> {
    private _processedCount;
    readonly processedCount: ReadOnlyObservable<number>;
    readonly didFinish: TypedEvent<void>;
    readonly foundResult: TypedEvent<TO>;
    private _results;
    constructor(props: SlowResultsProps<TO, TI>);
    private run;
}
