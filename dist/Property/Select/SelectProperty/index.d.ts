import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property } from "../..";
import { MongoDb } from "../../..";
import { Dimension } from "../../../Dimension";
import { SelectDimension } from "../SelectDimension";
export interface SelectPropertyOption {
    key: string;
    label: string;
    colorName: string;
    isDeleted?: boolean;
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
    static writeDefinition(db: MongoDb, definition: SelectPropertyDefinition): Promise<SelectProperty>;
    constructor(props: SelectPropertyProps);
    toSelectDimension<T>(): SelectDimension<T>;
    toDimensions(): Promise<Dimension<any>[]>;
}
