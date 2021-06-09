import { PropsObject } from "../PropsObject";
import { Dict } from "@anderjason/observable";
import { SqlClient } from "../SqlClient";
export interface MetricProps {
    metricKey: string;
    db: SqlClient;
}
export declare class Metric extends PropsObject<MetricProps> {
    readonly key: string;
    entryMetricValues: Dict<number>;
    constructor(props: MetricProps);
    toOptionalValueGivenEntryKey(entryKey: string): number | undefined;
    setEntryMetricValue(entryKey: string, value: number): void;
    hasValueGivenEntryKey(entryKey: string): boolean;
    removeValueGivenEntryKey(metricKey: string): void;
    load(): void;
    save(): void;
}
