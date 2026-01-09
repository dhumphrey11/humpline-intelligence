import { AggregatedCandle, Candle } from './types.js';
import { bucketEndTime, ONE_HOUR_MS } from './time.js';

interface AggregateResult {
  candles: AggregatedCandle[];
  complete: boolean;
  missingBuckets: Date[];
}

function expectedTimestamps(bucketEnd: Date, timeframe: '6h' | '1d'): number[] {
  const steps = timeframe === '6h' ? 6 : 24;
  const tsList: number[] = [];
  for (let i = steps - 1; i >= 0; i -= 1) {
    tsList.push(bucketEnd.getTime() - i * ONE_HOUR_MS);
  }
  return tsList;
}

export function aggregateCandles(
  candles: Candle[],
  timeframe: '6h' | '1d',
  cutoff?: Date
): AggregateResult {
  const filtered = cutoff
    ? candles.filter((candle) => candle.ts.getTime() <= cutoff.getTime())
    : candles;
  const buckets = new Map<number, Candle[]>();
  for (const candle of filtered) {
    const bucketEnd = bucketEndTime(candle.ts, timeframe).getTime();
    if (!buckets.has(bucketEnd)) {
      buckets.set(bucketEnd, []);
    }
    buckets.get(bucketEnd)?.push(candle);
  }

  const aggregated: AggregatedCandle[] = [];
  const missingBuckets: Date[] = [];

  for (const [bucketEndMs, bucketCandles] of buckets.entries()) {
    const expected = expectedTimestamps(new Date(bucketEndMs), timeframe);
    const candleMap = new Map(bucketCandles.map((c) => [c.ts.getTime(), c]));
    const full = expected.every((ts) => candleMap.has(ts));
    if (!full) {
      missingBuckets.push(new Date(bucketEndMs));
      continue;
    }
    const ordered = expected.map((ts) => candleMap.get(ts) as Candle);
    const open = ordered[0].open;
    const close = ordered[ordered.length - 1].close;
    const high = Math.max(...ordered.map((c) => c.high));
    const low = Math.min(...ordered.map((c) => c.low));
    const volume = ordered.reduce((sum, c) => sum + c.volume, 0);
    aggregated.push({
      symbol: ordered[0].symbol,
      ts: new Date(bucketEndMs),
      open,
      high,
      low,
      close,
      volume,
      timeframe
    });
  }

  aggregated.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  missingBuckets.sort((a, b) => a.getTime() - b.getTime());

  return {
    candles: aggregated,
    complete: missingBuckets.length === 0,
    missingBuckets
  };
}
