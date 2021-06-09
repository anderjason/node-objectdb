export class PropsObject<T = any> {
  private _props: T;

  constructor(props: T) {
    this._props = props;
  }

  get props(): T {
    return this._props;
  }
}
