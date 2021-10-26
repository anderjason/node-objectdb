import { MongoDb } from "../../MongoDb";
export interface BucketIdentifiersOfEntryStringParams {
    propertyName: string;
    dimensionKey?: string;
    labelGivenKey?: (key: string) => string;
}
export declare function bucketIdentifiersOfEntryString(params: BucketIdentifiersOfEntryStringParams): (db: MongoDb) => Promise<{
    dimensionKey: string;
    bucketKey: any;
    bucketLabel: any;
}[]>;
