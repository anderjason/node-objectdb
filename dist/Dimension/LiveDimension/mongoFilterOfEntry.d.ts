import { BucketIdentifier } from "..";
export declare function mongoFilterOfEntryString(propertyName: string): (bucketIdentifier: BucketIdentifier) => {
    [x: string]: string;
};
