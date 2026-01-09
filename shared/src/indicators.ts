import { Candle } from './types.js';
import { mean, std } from './math.js';

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  result.push(prev);
  for (let i = 1; i < values.length; i += 1) {
    const next = values[i] * k + prev * (1 - k);
    result.push(next);
    prev = next;
  }
  return result;
}

export function rsi(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }
  if (values.length <= period) {
    return new Array(values.length).fill(50);
  }
  const result: number[] = new Array(values.length).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function atr(candles: Candle[], period: number): number[] {
  if (candles.length === 0) {
    return [];
  }
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
    } else {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
  }
  if (candles.length < period) {
    return trs;
  }
  const result: number[] = new Array(candles.length).fill(trs[0]);
  let atrPrev = mean(trs.slice(0, period));
  result[period - 1] = atrPrev;
  for (let i = period; i < trs.length; i += 1) {
    atrPrev = (atrPrev * (period - 1) + trs[i]) / period;
    result[i] = atrPrev;
  }
  return result;
}

export interface BollingerPoint {
  middle: number;
  upper: number;
  lower: number;
  bandwidth: number;
}

export function bollinger(values: number[], period: number, stdev = 2): BollingerPoint[] {
  const result: BollingerPoint[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) {
      const value = values[i];
      result.push({ middle: value, upper: value, lower: value, bandwidth: 0 });
      continue;
    }
    const window = values.slice(i + 1 - period, i + 1);
    const mid = mean(window);
    const deviation = std(window);
    const upper = mid + stdev * deviation;
    const lower = mid - stdev * deviation;
    const bandwidth = mid === 0 ? 0 : (upper - lower) / mid;
    result.push({ middle: mid, upper, lower, bandwidth });
  }
  return result;
}
