import {
  Observable, ReadOnlyObservable, TypedEvent
} from "@anderjason/observable";
import { PropsObject } from "skytree";

export interface SlowResultsProps<TO, TI = any> {
  getItems: () => AsyncGenerator<TI>;
  fn: (item: TI) => Promise<TO | undefined>;
}

export class SlowResults<TO, TI = any> extends PropsObject<
  SlowResultsProps<TO, TI>
> {
  private _processedCount = Observable.ofEmpty<number>();
  readonly processedCount = ReadOnlyObservable.givenObservable(
    this._processedCount
  );

  readonly didFinish = new TypedEvent<void>();
  readonly foundResult = new TypedEvent<TO>();

  private _results: TO[] = [];

  constructor(props: SlowResultsProps<TO, TI>) {
    super(props);

    this.run();
  }

  private async run() {
    this._processedCount.setValue(0);
    this._results = [];

    for await (const item of this.props.getItems()) {
      const output = await this.props.fn(item);
      
      if (output != null) {
        this._results.push(output);
        this.foundResult.emit(output);
      }

      this._processedCount.setValue(this._processedCount.value + 1);
    }

    this.didFinish.emit();
  }
}
