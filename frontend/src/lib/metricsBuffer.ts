const MAX = 60;

class RingBuffer {
  private values: number[] = [];

  push(v: number) {
    this.values.push(v);
    if (this.values.length > MAX) this.values.shift();
  }

  toArray() {
    return [...this.values];
  }
}

const buffers = new Map<string, RingBuffer>();

export function pushMetric(key: string, value: number) {
  if (!buffers.has(key)) buffers.set(key, new RingBuffer());
  buffers.get(key)!.push(value);
}

export function getMetricSeries(key: string): number[] {
  return buffers.get(key)?.toArray() ?? [];
}

export function sparklineData(key: string) {
  return getMetricSeries(key).map((v, i) => ({ i, v }));
}
