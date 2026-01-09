import { AssetSymbol, ExecConfig, PortfolioSymbol, RebalancePlan, TradeOrder } from './types.js';

export interface PortfolioSnapshot {
  equity: number;
  cash: number;
  holdings: Record<AssetSymbol, number>;
}

export type PriceMap = Record<AssetSymbol, number>;

export function computeWeights(snapshot: PortfolioSnapshot, prices: PriceMap): Record<PortfolioSymbol, number> {
  const weights: Record<PortfolioSymbol, number> = {
    BTC: 0,
    ETH: 0,
    ADA: 0,
    CASH: 0
  };
  if (snapshot.equity <= 0) {
    weights.CASH = 1;
    return weights;
  }
  for (const [symbol, qty] of Object.entries(snapshot.holdings)) {
    const asset = symbol as AssetSymbol;
    const price = prices[asset] ?? 0;
    weights[asset as PortfolioSymbol] = (qty * price) / snapshot.equity;
  }
  weights.CASH = snapshot.cash / snapshot.equity;
  return weights;
}

export function planRebalance(
  snapshot: PortfolioSnapshot,
  targetWeights: Record<PortfolioSymbol, number>,
  prices: PriceMap,
  config: ExecConfig,
  allowTrade: boolean
): RebalancePlan {
  if (!allowTrade) {
    return { planned: false, orders: [] };
  }
  const currentWeights = computeWeights(snapshot, prices);
  const diffs = Object.keys(targetWeights).map((symbol) =>
    Math.abs(targetWeights[symbol as PortfolioSymbol] - (currentWeights[symbol as PortfolioSymbol] ?? 0))
  );
  const needsRebalance = diffs.some((diff) => diff >= config.rebalance_band);
  if (!needsRebalance) {
    return { planned: false, orders: [] };
  }

  const orders: TradeOrder[] = [];
  let cash = snapshot.cash;
  const updatedHoldings: Record<AssetSymbol, number> = { ...snapshot.holdings };

  for (const symbol of ['BTC', 'ETH', 'ADA'] as AssetSymbol[]) {
    const price = prices[symbol] ?? 0;
    if (price <= 0) {
      continue;
    }
    const currentQty = snapshot.holdings[symbol] ?? 0;
    const targetValue = snapshot.equity * (targetWeights[symbol as PortfolioSymbol] ?? 0);
    const currentValue = currentQty * price;
    const deltaValue = targetValue - currentValue;
    if (Math.abs(deltaValue) < config.min_trade_usd) {
      continue;
    }

    const side = deltaValue > 0 ? 'BUY' : 'SELL';
    const slippage = config.slippage_bps[symbol] ?? 0;
    const effectivePrice = side === 'BUY'
      ? price * (1 + slippage / 10000)
      : price * (1 - slippage / 10000);
    const qty = Math.abs(deltaValue) / effectivePrice;
    const notional = qty * effectivePrice;
    const fee = notional * (config.fee_bps / 10000);

    if (side === 'BUY' && cash < notional + fee) {
      continue;
    }

    let orderQty = qty;
    let orderNotional = notional;
    let orderFee = fee;

    if (side === 'BUY') {
      cash -= orderNotional + orderFee;
      updatedHoldings[symbol] = (updatedHoldings[symbol] ?? 0) + orderQty;
    } else {
      const available = updatedHoldings[symbol] ?? 0;
      const sellQty = Math.min(available, orderQty);
      if (sellQty <= 0) {
        continue;
      }
      orderQty = sellQty;
      orderNotional = orderQty * effectivePrice;
      orderFee = orderNotional * (config.fee_bps / 10000);
      cash += orderNotional - orderFee;
      updatedHoldings[symbol] = available - orderQty;
    }

    orders.push({
      symbol,
      side,
      qty: orderQty,
      price: effectivePrice,
      notional_usd: orderNotional,
      fee_usd: orderFee,
      slippage_bps: slippage,
      reason: 'rebalance',
      metadata: {
        target_value: targetValue,
        current_value: currentValue,
        rebalance_band: config.rebalance_band
      }
    });
  }

  return { planned: orders.length > 0, orders };
}
