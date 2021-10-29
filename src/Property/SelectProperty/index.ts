import { ValuePath } from "@anderjason/util";
import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property, PropertyType } from "..";
import { LiveDimension } from "../..";

export interface SelectPropertyOption {
  key: string;
  label: string;
}

export interface SelectPropertyDefinition extends BasePropertyDefinition {
  propertyType: "select";
  options: SelectPropertyOption[];
}

export interface SelectPropertyProps {
  definition: SelectPropertyDefinition;
}

export class SelectProperty extends PropsObject<SelectPropertyProps> implements Property {
  readonly definition: SelectPropertyDefinition;

  constructor(props: SelectPropertyProps) {
    super(props);
    
    this.definition = props.definition;
  }

  async toDimensions(): Promise<LiveDimension<any>[]> {
    return [
      LiveDimension.ofEntry({
        dimensionKey: this.definition.key,
        dimensionLabel: this.definition.label,
        valuePath: ValuePath.givenParts(["propertyValues", this.definition.key]),
        valueType: "single",
      })
    ];
  }
}