export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function std(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

export function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  const xAvg = (n - 1) / 2;
  const yAvg = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i - xAvg;
    numerator += x * (values[i] - yAvg);
    denominator += x * x;
  }
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function percentileRank(values: number[], latest: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= latest);
  if (index === -1) {
    return 1;
  }
  return index / (sorted.length - 1 || 1);
}
