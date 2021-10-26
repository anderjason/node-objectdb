export declare class Benchmark {
    readonly totalCount: number;
    private counted;
    private bucketSize;
    private startTime;
    private durationPerBucket;
    private bucketDidFinish;
    private countSize;
    constructor(totalCount: number, bucketSize?: number, bucketDidFinish?: () => void);
    log(message: string): void;
}
