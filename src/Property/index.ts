import { Dimension } from "../Dimension";
import { SelectProperty, SelectPropertyDefinition } from "./SelectProperty";

export type PropertyType = "select";

export interface Property {
  toDimensions: () => Promise<Dimension<any>[]>;
}

export interface BasePropertyDefinition {
  readonly key: string;
  readonly propertyType: PropertyType;

  label: string;
  listOrder: number;
}

export type PropertyDefinition = SelectPropertyDefinition;

export function propertyGivenDefinition(definition: PropertyDefinition): Property {
  switch (definition.propertyType) {
    case "select":
      return new SelectProperty({ definition });
    default:
      throw new Error(`Unsupported property type: ${definition.propertyType}`);
  }
}