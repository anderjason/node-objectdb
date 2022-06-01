import {
  Observable,
  ReadOnlyObservable,
  TypedEvent,
} from "@anderjason/observable";
import { StringUtil } from "@anderjason/util";
import { Actor } from "skytree";

export interface SlowResultProps<TO, TI = any> {
  fn: (item: TI) => Promise<TO | undefined>;

  label?: string;
  getItems?: () => AsyncGenerator<TI>;
  getTotalCount?: () => Promise<number>;
}

export type SlowResultStatus = "busy" | "done" | "error";

async function* defaultGetItems<TI>(): AsyncGenerator<TI> {
  yield undefined;
}

export class SlowResult<TO, TI = any> extends Actor<SlowResultProps<TO, TI>> {
  readonly key = StringUtil.stringOfRandomCharacters(8);

  private _status = Observable.givenValue<SlowResultStatus>("busy");
  readonly status = ReadOnlyObservable.givenObservable(this._status);

  readonly foundResult = new TypedEvent<TO>();
  readonly error = new TypedEvent<string>();

  private _processedCount: number = 0;
  get processedCount(): number {
    return this._processedCount;
  }

  private _totalCount: number | undefined;
  get totalCount(): number | undefined {
    return this._totalCount;
  }

  private _results: TO[] = [];
  get results(): TO[] {
    return this._results;
  }

  private _errors: string[] = [];
  get errors(): string[] {
    return this._errors;
  }

  get label(): string {
    return this.props.label ?? "Processing...";
  }

  onActivate() {
    setTimeout(() => {
      this.run();
    }, 1);
  }

  private async run() {
    this._status.setValue("busy");
    this._results = [];
    this._processedCount = 0;

    if (this.props.getTotalCount != null) {
      this._totalCount = await this.props.getTotalCount();
    }

    // if getItems is not provided, fn will be called one time with an undefined item
    let items =
      this.props.getItems != null
        ? this.props.getItems()
        : defaultGetItems<TI>();

    for await (const item of items) {
      if (this.isActive == false) {
        // cancelled
        break;
      }

      try {
        const output = await this.props.fn(item);

        // @ts-ignore
        if (this.isActive == false) {
          // cancelled
          break;
        }

        if (output != null) {
          this._results.push(output);
          this.foundResult.emit(output);
        }
      } catch (err) {
        const error = String(err);
        this._errors.push(error);
        this.error.emit(error);
        this._status.setValue("error");
        return;
      }

      this._processedCount += 1;
    }

    this._status.setValue("done");
  }
}
