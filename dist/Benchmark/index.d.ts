export declare class Benchmark {
    readonly totalCount: number;
    private remainingCount;
    private bucketSize;
    private startTime;
    private durationPerBucket;
    private bucketDidFinish;
    constructor(totalCount: number, bucketSize?: number, bucketDidFinish?: () => void);
    log(message: string): void;
}
