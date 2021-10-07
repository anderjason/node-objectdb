import { Actor } from "skytree";
import { ReadOnlyMap } from "../ReadOnlyMap";
import { DbInstance } from "../SqlClient";
export interface MetricProps {
    metricKey: string;
    db: DbInstance;
}
export declare class Metric extends Actor<MetricProps> {
    readonly key: string;
    private _entryMetricValues;
    private _readOnlyMetricValues;
    private _upsertEntryMetricValueQuery;
    private _deleteEntryMetricValueQuery;
    constructor(props: MetricProps);
    onActivate(): void;
    toEntryMetricValues(): Promise<ReadOnlyMap<string, string>>;
    private loadOnce;
    setValue(key: string, newValue: string): Promise<void>;
    deleteKey(key: string): Promise<void>;
}
