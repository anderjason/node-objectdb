import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property } from "..";
import { Dimension } from "../../Dimension";
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
    readonly definition: SelectPropertyDefinition;
    constructor(props: SelectPropertyProps);
    toDimensions(): Promise<Dimension<any>[]>;
}
