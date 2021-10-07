import { Actor } from "skytree";
import { ObjectDb } from "..";
import { ReadOnlyMap } from "../ReadOnlyMap";
import { Bucket } from "./Bucket";

export interface DimensionProps<T> {
  key: string;
  label: string;
  objectDb: ObjectDb<T>;
}

export class Dimension<T> extends Actor<DimensionProps<T>> {
  private _buckets = new Map<string, Bucket>();
  
  readonly buckets = new ReadOnlyMap(this._buckets);

  onActivate() {
    this.cancelOnDeactivate(
      this.props.objectDb.entryDidChange.subscribe((change) => {
        
      })
    )
  }
}
