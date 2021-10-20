export class Benchmark {
  readonly totalCount: number;

  private remainingCount: number = 0;
  private bucketSize: number;
  private startTime: number;
  private durationPerBucket: number = 0;

  constructor(totalCount: number) {
    this.remainingCount = totalCount;
    this.bucketSize = Math.ceil(totalCount / 10);
    this.startTime = new Date().getTime();
  }

  log(message: string): void {
    console.log(`${message} (${this.remainingCount} remaining, ${this.durationPerBucket}ms per ${this.bucketSize})`);

    this.remainingCount -= 1;

    if (this.remainingCount % this.bucketSize === 0) {
      const now = new Date().getTime();

      this.durationPerBucket = now - this.startTime;
      this.startTime = now;
    }
  }
}