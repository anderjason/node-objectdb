"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricResult = exports.Metric = void 0;
class Metric {
    constructor(name) {
        this.children = [];
        this.name = name;
        this._startTime = new Date().getTime();
    }
    get isRunning() {
        return this._startTime != null;
    }
    get durationMs() {
        return this._durationMs;
    }
    addChildMetric(metric) {
        if (metric == null) {
            return;
        }
        this.children.push(metric);
    }
    stop() {
        if (this._startTime == null) {
            return;
        }
        const now = new Date().getTime();
        this._durationMs = now - this._startTime;
        this._startTime = undefined;
    }
    toPortableObject() {
        if (this.isRunning) {
            throw new Error("Cannot serialize a metric that is still running");
        }
        const result = {
            name: this.name,
            durationMs: this.durationMs,
        };
        if (this.children.length > 0) {
            result.children = this.children.map((child) => child.toPortableObject());
        }
        return result;
    }
}
exports.Metric = Metric;
class MetricResult {
    constructor(metric, value) {
        if (metric != null) {
            metric.stop();
        }
        this.metric = metric;
        this.value = value;
    }
}
exports.MetricResult = MetricResult;
//# sourceMappingURL=index.js.map