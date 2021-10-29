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
  readonly key: string;
  readonly propertyType: PropertyType;
  
  label: string;
  listOrder: number;
  options: SelectPropertyOption[];

  constructor(props: SelectPropertyProps) {
    super(props);
    
    this.key = props.definition.key;
    this.propertyType = props.definition.propertyType;
    this.label = props.definition.label;
    this.options = props.definition.options;
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