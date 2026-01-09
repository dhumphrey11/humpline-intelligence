import crypto from 'node:crypto';
import { AssetSymbol, Candle } from './types.js';

export function hashInputs(
  model_id: string,
  tick_id: Date,
  candlesBySymbol: Record<AssetSymbol, Candle[]>
): string {
  const payload = {
    model_id,
    tick_id: tick_id.toISOString(),
    candles: Object.fromEntries(
      Object.entries(candlesBySymbol).map(([symbol, candles]) => [
        symbol,
        candles.map((c) => c.ts.toISOString())
      ])
    )
  };
  const encoded = JSON.stringify(payload);
  return crypto.createHash('sha256').update(encoded).digest('hex');
}
