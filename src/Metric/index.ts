interface PortableMetric {
  name: string;
  durationMs: number;
  children?: PortableMetric[];
}

export class Metric {
  readonly name: string;
  readonly children: Metric[] = [];

  private _startTime: number | undefined;
  private _durationMs: number | undefined;

  get isRunning(): boolean {
    return this._startTime != null;
  }

  get durationMs(): number | undefined {
    return this._durationMs;
  }

  constructor(name: string) {
    this.name = name;
    this._startTime = new Date().getTime();
  }

  addChildMetric(metric?: Metric): void {
    if (metric == null) {
      return;
    }

    this.children.push(metric);
  }

  stop(): void {
    if (this._startTime == null) {
      return;
    }

    const now = new Date().getTime();
    this._durationMs = now - this._startTime;
    this._startTime = undefined;
  }

  toPortableObject(): PortableMetric {
    if (this._durationMs == null) {
      throw new Error("Cannot serialize a metric that is still running");
    }

    const result: PortableMetric = {
      name: this.name,
      durationMs: this._durationMs,
    };

    if (this.children.length > 0) {
      result.children = this.children.map((child) => child.toPortableObject());
    }

    return result;
  }
}

export class MetricResult<T = void> {
  readonly metric: Metric | undefined;
  readonly value: T;

  constructor(metric: Metric | undefined, value: T) {
    if (metric != null) {
      metric.stop();
    }

    this.metric = metric;
    this.value = value;
  }
}
