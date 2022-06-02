interface PortableMetric {
    name: string;
    durationMs: number;
    children?: PortableMetric[];
}
export declare class Metric {
    readonly name: string;
    readonly children: Metric[];
    private _startTime;
    private _durationMs;
    get isRunning(): boolean;
    get durationMs(): number | undefined;
    constructor(name: string);
    addChildMetric(metric?: Metric): void;
    stop(): void;
    toPortableObject(): PortableMetric;
}
export declare class MetricResult<T = void> {
    readonly metric: Metric | undefined;
    readonly value: T;
    constructor(metric: Metric | undefined, value: T);
}
export {};
