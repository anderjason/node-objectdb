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
export declare class SelectProperty extends PropsObject<SelectPropertyProps> implements Property {
    readonly key: string;
    readonly propertyType: PropertyType;
    label: string;
    listOrder: number;
    options: SelectPropertyOption[];
    constructor(props: SelectPropertyProps);
    toDimensions(): Promise<LiveDimension<any>[]>;
}
