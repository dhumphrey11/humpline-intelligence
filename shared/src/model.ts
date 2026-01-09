import { aggregateCandles } from './aggregation.js';
import { AllocationResult, AssetSymbol, Candle, FactorOutputs, SignalOutput } from './types.js';
import { atr, bollinger, ema, rsi } from './indicators.js';
import { clamp, linearRegressionSlope, percentileRank } from './math.js';
import { allocateTargets } from './allocation.js';

interface FactorConfigInternal {
  trend_weight: number;
  momentum_weight: number;
  vol_weight: number;
  signal_threshold_buy: number;
  signal_threshold_sell: number;
}

export interface ModelSignalResult {
  signals: SignalOutput[];
  allocation: AllocationResult;
  factorOutputs: Record<AssetSymbol, FactorOutputs>;
}

export function computeSignals(
  candles1h: Record<AssetSymbol, Candle[]>,
  tickId: Date,
  factorConfig: FactorConfigInternal
): ModelSignalResult {
  const signals: SignalOutput[] = [];
  const factors: Record<AssetSymbol, FactorOutputs> = {
    BTC: { trend: 0, momentum: 0, volatility: 0 },
    ETH: { trend: 0, momentum: 0, volatility: 0 },
    ADA: { trend: 0, momentum: 0, volatility: 0 }
  };

  for (const symbol of Object.keys(candles1h) as AssetSymbol[]) {
    const hourly = candles1h[symbol].filter((c) => c.ts.getTime() <= tickId.getTime());
    const sixHourAgg = aggregateCandles(hourly, '6h', tickId);
    const dayAgg = aggregateCandles(hourly, '1d', tickId);

    const sixH = sixHourAgg.candles;
    const oneD = dayAgg.candles;

    const dayCloses = oneD.map((c) => c.close);
    const ema50 = ema(dayCloses, 50);
    const ema200 = ema(dayCloses, 200);
    const ema50Latest = ema50[ema50.length - 1] ?? 0;
    const ema200Latest = ema200[ema200.length - 1] ?? 0;
    const slopeWindow = ema50.slice(-10);
    const slope = linearRegressionSlope(slopeWindow);
    const slopePct = ema50Latest === 0 ? 0 : slope / ema50Latest;
    const trendScore = clamp((ema200Latest === 0 ? 0 : ema50Latest / ema200Latest - 1) + slopePct, -1, 1);

    const sixCloses = sixH.map((c) => c.close);
    const sixRsi = rsi(sixCloses, 14);
    const dayRsi = rsi(dayCloses, 14);
    const momentumScore = clamp(
      ((sixRsi[sixRsi.length - 1] ?? 50) - 50) / 50 * 0.5 +
      ((dayRsi[dayRsi.length - 1] ?? 50) - 50) / 50 * 0.5,
      -1,
      1
    );

    const atrValues = atr(sixH, 14);
    const atrPctSeries = atrValues.map((value, index) => {
      const close = sixH[index]?.close ?? 0;
      return close === 0 ? 0 : value / close;
    });
    const boll = bollinger(sixCloses, 20);
    const bandwidthSeries = boll.map((b) => b.bandwidth);
    const lookback = 100;
    const atrSlice = atrPctSeries.slice(-lookback);
    const bandSlice = bandwidthSeries.slice(-lookback);
    const atrPct = atrPctSeries[atrPctSeries.length - 1] ?? 0;
    const bandPct = bandwidthSeries[bandwidthSeries.length - 1] ?? 0;
    const atrPercentile = percentileRank(atrSlice, atrPct);
    const bandPercentile = percentileRank(bandSlice, bandPct);
    const avgPercentile = (atrPercentile + bandPercentile) / 2;
    const volScore = clamp(1 - 2 * avgPercentile, -1, 1);

    const composite =
      factorConfig.trend_weight * trendScore +
      factorConfig.momentum_weight * momentumScore +
      factorConfig.vol_weight * volScore;

    const signal = composite >= factorConfig.signal_threshold_buy
      ? 'BUY'
      : composite <= factorConfig.signal_threshold_sell
        ? 'SELL'
        : 'HOLD';

    const factorBreakdown = { trend: trendScore, momentum: momentumScore, volatility: volScore };
    const strength = Math.min(100, Math.round(Math.abs(composite) * 100));
    const agreement = [trendScore, momentumScore, volScore].filter((value) =>
      composite >= 0 ? value > 0 : value < 0
    ).length;
    const confidence = clamp(strength + agreement * 10, 0, 100);

    factors[symbol] = factorBreakdown;
    signals.push({
      symbol,
      asset_score: composite,
      signal,
      confidence,
      factor_breakdown: factorBreakdown
    });
  }

  const allocation = allocateTargets(signals);
  return { signals, allocation, factorOutputs: factors };
}
