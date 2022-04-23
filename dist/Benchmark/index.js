"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Benchmark = void 0;
class Benchmark {
    constructor(totalCount, bucketSize, bucketDidFinish) {
        this.durationPerBucket = 0;
        this.totalCount = totalCount;
        this.countSize = String(totalCount).length;
        this.counted = 0;
        this.bucketSize = bucketSize !== null && bucketSize !== void 0 ? bucketSize : Math.ceil(totalCount / 10);
        this.startTime = new Date().getTime();
        this.bucketDidFinish = bucketDidFinish;
    }
    log(message) {
        this.counted += 1;
        const countedStr = String(this.counted).padStart(this.countSize);
        console.log(`${message} (${countedStr}/${this.totalCount}, ${this.durationPerBucket}ms per ${this.bucketSize})`);
        if (this.counted === this.totalCount || this.counted % this.bucketSize === 0) {
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