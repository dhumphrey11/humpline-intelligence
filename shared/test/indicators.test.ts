import { describe, expect, it } from 'vitest';
import { atr, bollinger, ema, rsi } from '../src/indicators.js';
import type { Candle } from '../src/types.js';

const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
  symbol: 'BTC',
  ts: new Date(Date.UTC(2024, 0, 1, i + 1)),
  open: 100 + i,
  high: 102 + i,
  low: 98 + i,
  close: 100 + i,
  volume: 10
}));

const closes = candles.map((c) => c.close);

describe('indicators', () => {
  it('ema tracks trend', () => {
    const values = ema(closes, 5);
    expect(values.length).toBe(closes.length);
    expect(values[values.length - 1]).toBeGreaterThan(values[0]);
  });

  it('rsi is neutral for flat series', () => {
    const flat = new Array(20).fill(100);
    const values = rsi(flat, 14);
    expect(values[values.length - 1]).toBe(50);
  });

  it('atr is positive', () => {
    const values = atr(candles, 14);
    expect(values[values.length - 1]).toBeGreaterThan(0);
  });

  it('bollinger returns bands', () => {
    const values = bollinger(closes, 10);
    expect(values[values.length - 1].upper).toBeGreaterThan(values[values.length - 1].lower);
  });
});
