import { AllocationResult, PortfolioSymbol, SignalOutput } from './types.js';

export function allocateTargets(signals: SignalOutput[]): AllocationResult {
  const desirability: Record<string, number> = {};
  let sum = 0;
  for (const signal of signals) {
    const d = signal.signal === 'BUY'
      ? Math.pow(signal.confidence / 100, 2) * Math.max(signal.asset_score, 0)
      : 0;
    desirability[signal.symbol] = d;
    sum += d;
  }

  const weights: Record<PortfolioSymbol, number> = {
    BTC: 0,
    ETH: 0,
    ADA: 0,
    CASH: 0
  };

  if (sum === 0) {
    weights.CASH = 1;
    return { weights, desirability: desirability as Record<any, number> };
  }

  for (const [symbol, d] of Object.entries(desirability)) {
    weights[symbol as PortfolioSymbol] = d / sum;
  }
  weights.CASH = 0;

  return { weights, desirability: desirability as Record<any, number> };
}
