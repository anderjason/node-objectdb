export declare type MetricValue = number;
export interface PortableKeyObject {
    readonly key: string;
}
export interface PortableEntry extends PortableKeyObject {
    createdAtMs: number;
    updatedAtMs: number;
    data: any;
    tagKeys?: string[];
    metricValues?: {
        [metricKey: string]: number;
    };
}
