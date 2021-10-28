import { PropsObject } from "skytree";
import { Property } from "..";
import { LiveDimension } from "../..";
export interface SelectPropertyProps {
    key: string;
    label: string;
}
export declare class SelectProperty extends PropsObject<SelectPropertyProps> implements Property {
    readonly key: string;
    readonly label: string;
    constructor(props: SelectPropertyProps);
    toDimensions(): Promise<LiveDimension<any>[]>;
}
