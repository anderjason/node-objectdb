import { Actor } from "skytree";
import { MongoDb } from "..";
export interface MetricProps {
    metricKey: string;
    db: MongoDb;
}
export declare class Metric extends Actor<MetricProps> {
    readonly key: string;
    private _entryMetricValues;
    private _upsertEntryMetricValueQuery;
    private _deleteEntryMetricValueQuery;
    constructor(props: MetricProps);
    onActivate(): void;
    toEntryMetricValues(): Promise<Map<string, string>>;
    private loadOnce;
    setValue(key: string, newValue: string): Promise<void>;
    deleteKey(key: string): Promise<void>;
}
