import { ObservableDict } from "@anderjason/observable";
import { DbInstance } from "../SqlClient";
import { Actor } from "skytree";
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
