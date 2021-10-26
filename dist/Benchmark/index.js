"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Benchmark = void 0;
class Benchmark {
    constructor(totalCount, bucketSize, bucketDidFinish) {
        this.remainingCount = 0;
        this.durationPerBucket = 0;
        this.remainingCount = totalCount;
        this.bucketSize = bucketSize !== null && bucketSize !== void 0 ? bucketSize : Math.ceil(totalCount / 10);
        this.startTime = new Date().getTime();
        this.bucketDidFinish = bucketDidFinish;
    }
    log(message) {
        console.log(`${message} (${this.remainingCount} remaining, ${this.durationPerBucket}ms per ${this.bucketSize})`);
        this.remainingCount -= 1;
        if (this.remainingCount % this.bucketSize === 0) {
            const now = new Date().getTime();
            this.durationPerBucket = now - this.startTime;
            this.startTime = now;
            if (this.bucketDidFinish != null) {
                this.bucketDidFinish();
            }
        }
    }
}
exports.Benchmark = Benchmark;
//# sourceMappingURL=index.js.map