import { ObservableDict } from "@anderjason/observable";
import { Actor } from "skytree";
import { DbInstance } from "../SqlClient";
export interface MetricProps {
    metricKey: string;
    db: DbInstance;
}
export declare class Metric extends Actor<MetricProps> {
    readonly key: string;
    get entryMetricValues(): ObservableDict<number>;
    private _entryMetricValues;
    private _upsertEntryMetricValueQuery;
    private _deleteEntryMetricValueQuery;
    constructor(props: MetricProps);
    onActivate(): void;
    private loadOnce;
}
