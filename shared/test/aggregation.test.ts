import { describe, expect, it } from 'vitest';
import { aggregateCandles } from '../src/aggregation.js';
import type { Candle } from '../src/types.js';

function makeCandle(symbol: 'BTC', iso: string, close: number): Candle {
  return {
    symbol,
    ts: new Date(iso),
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 10
  };
}

describe('aggregateCandles', () => {
  it('aggregates a full 6h bucket', () => {
    const base = '2024-05-01T01:00:00.000Z';
    const candles: Candle[] = [];
    for (let i = 0; i < 6; i += 1) {
      const ts = new Date(new Date(base).getTime() + i * 60 * 60 * 1000).toISOString();
      candles.push(makeCandle('BTC', ts, 100 + i));
    }
    const result = aggregateCandles(candles, '6h');
    expect(result.candles).toHaveLength(1);
    expect(result.complete).toBe(true);
    expect(result.candles[0].close).toBe(105);
  });

  it('flags missing buckets', () => {
    const candles = [
      makeCandle('BTC', '2024-05-01T01:00:00.000Z', 100),
      makeCandle('BTC', '2024-05-01T02:00:00.000Z', 101)
    ];
    const result = aggregateCandles(candles, '6h');
    expect(result.complete).toBe(false);
    expect(result.candles).toHaveLength(0);
    expect(result.missingBuckets.length).toBeGreaterThan(0);
  });
});
