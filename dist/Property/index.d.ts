import { Dimension } from "../Dimension";
import { SelectPropertyDefinition } from "./SelectProperty";
export declare type PropertyType = "select";
export interface Property {
    toDimensions: () => Promise<Dimension<any>[]>;
}
export interface BasePropertyDefinition {
    readonly key: string;
    readonly propertyType: PropertyType;
    label: string;
    listOrder: number;
}
export declare type PropertyDefinition = SelectPropertyDefinition;
export declare function propertyGivenDefinition(definition: PropertyDefinition): Property;
