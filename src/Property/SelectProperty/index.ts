import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { Property } from "..";
import { LiveDimension } from "../..";

export interface SelectPropertyProps {
  key: string;
  label: string;
}

export class SelectProperty extends PropsObject<SelectPropertyProps> implements Property {
  readonly key: string;
  readonly label: string;

  constructor(props: SelectPropertyProps) {
    super(props);
    
    this.key = props.key;
    this.label = props.label;
  }

  async toDimensions(): Promise<LiveDimension<any>[]> {
    return [
      LiveDimension.ofEntry({
        dimensionKey: this.key,
        dimensionLabel: this.label,
        valuePath: ValuePath.givenParts(["propertyValues", this.key]),
        valueType: "single",
      })
    ];
  }
}