import { Actor } from "skytree";
import { ReadOnlyMap } from "../ReadOnlyMap";
import { DbInstance } from "../SqlClient";
export interface MetricProps {
    metricKey: string;
    db: DbInstance;
}
export declare class Metric extends Actor<MetricProps> {
    readonly key: string;
    get entryMetricValues(): ReadOnlyMap<string, number>;
    private _entryMetricValues;
    private _readOnlyMetricValues;
    private _upsertEntryMetricValueQuery;
    private _deleteEntryMetricValueQuery;
    constructor(props: MetricProps);
    onActivate(): void;
    private loadOnce;
    setValue(key: string, newValue: number): void;
    deleteKey(key: string): void;
}
