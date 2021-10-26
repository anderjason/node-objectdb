export class Benchmark {
  readonly totalCount: number;

  private counted: number;
  private bucketSize: number;
  private startTime: number;
  private durationPerBucket: number = 0;
  private bucketDidFinish: () => void;
  private countSize: number;

  constructor(totalCount: number, bucketSize?: number, bucketDidFinish?: () => void) {
    this.totalCount = totalCount;
    this.countSize = String(totalCount).length;
    this.counted = 0;
    this.bucketSize = bucketSize ?? Math.ceil(totalCount / 10);
    this.startTime = new Date().getTime();
    this.bucketDidFinish = bucketDidFinish;
  }

  log(message: string): void {
    const countedStr = String(this.counted).padStart(this.countSize);
    
    console.log(`${message} (${countedStr}/${this.totalCount}, ${this.durationPerBucket}ms per ${this.bucketSize})`);

    if (this.counted % this.bucketSize === 0) {
      const now = new Date().getTime();

      this.durationPerBucket = now - this.startTime;
      this.startTime = now;

      if (this.bucketDidFinish != null) {
        this.bucketDidFinish();
      }
    }

    this.counted += 1;
  }
}
