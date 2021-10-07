import { Actor } from "skytree";
export interface BucketProps {
    key: string;
    label: string;
}
export declare class Bucket extends Actor<BucketProps> {
    onActivate(): void;
}
