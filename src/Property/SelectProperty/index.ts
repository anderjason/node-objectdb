import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property } from "..";
import { Dimension } from "../../Dimension";
import { SelectPropertyDimension } from "../../Dimension/SelectPropertyDimension";

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

  async toDimensions(): Promise<Dimension<any>[]> {
    return [
      new SelectPropertyDimension({
        property: this
      })
    ];
  }
}