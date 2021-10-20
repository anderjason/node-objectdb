export declare class Benchmark {
    readonly totalCount: number;
    private remainingCount;
    private bucketSize;
    private startTime;
    private durationPerBucket;
    constructor(totalCount: number);
    log(message: string): void;
}
