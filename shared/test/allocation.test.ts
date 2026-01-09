import { describe, expect, it } from 'vitest';
import { allocateTargets } from '../src/allocation.js';
import type { SignalOutput } from '../src/types.js';

describe('allocation', () => {
  it('allocates to cash when no buys', () => {
    const signals: SignalOutput[] = [
      { symbol: 'BTC', asset_score: -0.1, signal: 'HOLD', confidence: 50, factor_breakdown: { trend: 0, momentum: 0, volatility: 0 } }
    ];
    const result = allocateTargets(signals);
    expect(result.weights.CASH).toBe(1);
  });

  it('allocates proportionally for buys', () => {
    const signals: SignalOutput[] = [
      { symbol: 'BTC', asset_score: 0.5, signal: 'BUY', confidence: 80, factor_breakdown: { trend: 0, momentum: 0, volatility: 0 } },
      { symbol: 'ETH', asset_score: 0.2, signal: 'BUY', confidence: 60, factor_breakdown: { trend: 0, momentum: 0, volatility: 0 } }
    ];
    const result = allocateTargets(signals);
    expect(result.weights.CASH).toBe(0);
    expect(result.weights.BTC).toBeGreaterThan(result.weights.ETH);
  });
});
