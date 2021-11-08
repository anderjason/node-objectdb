import {
  Observable,
  ReadOnlyObservable,
  TypedEvent
} from "@anderjason/observable";
import { StringUtil } from "@anderjason/util";
import { Actor } from "skytree";

export interface SlowResultProps<TO, TI = any> {
  getItems: () => AsyncGenerator<TI>;
  fn: (item: TI) => Promise<TO | undefined>;
}

export type SlowResultStatus = "busy" | "done" | "error";

export class SlowResult<TO, TI = any> extends Actor<
  SlowResultProps<TO, TI>
> {
  readonly key = StringUtil.stringOfRandomCharacters(8);

  private _status = Observable.givenValue<SlowResultStatus>("busy");
  readonly status = ReadOnlyObservable.givenObservable(this._status);

  readonly foundResult = new TypedEvent<TO>();
  readonly error = new TypedEvent<string>();

  private _results: TO[] = [];
  get results(): TO[] {
    return this._results;
  }

  private _errors: string[] = [];
  get errors(): string[] {
    return this._errors;
  }

  get totalCount(): number | undefined {
    return undefined;
  }

  onActivate() {
    setTimeout(() => {
      this.run();
    }, 1);
  }

  private async run() {
    this._status.setValue("busy");
    this._results = [];

    for await (const item of this.props.getItems()) {
      if (this.isActive == false) {
        console.log("SlowResult cancelled 1");
        break;
      }

      try {
        const output = await this.props.fn(item);

        // @ts-ignore
        if (this.isActive == false) {
          console.log("SlowResult cancelled 2");
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
      }
    }

    this._status.setValue("done");
  }
}
