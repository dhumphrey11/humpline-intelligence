import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { resolveIdempotencyStatus } from './idempotency.js';
import {
  aggregateCandles,
  AssetSymbol,
  computeSignals,
  ExecConfig,
  hashInputs,
  PortfolioState,
  planRebalance,
  query,
  SIX_HOURS_MS,
  withTransaction
} from '@humpline/shared';
import { bucketEndTime, ONE_DAY_MS } from '@humpline/shared';

const app = express();
app.use(express.json());

const SYMBOLS: AssetSymbol[] = ['BTC', 'ETH', 'ADA'];

function latestBucketEnd(tickId: Date, timeframe: '6h' | '1d'): Date {
  const end = bucketEndTime(tickId, timeframe);
  const duration = timeframe === '6h' ? SIX_HOURS_MS : ONE_DAY_MS;
  if (end.getTime() > tickId.getTime()) {
    return new Date(end.getTime() - duration);
  }
  return end;
}

async function loadModel(model_id: string) {
  const result = await query(
    'SELECT model_id, model_name, is_active, is_contender, universe, decision_frequency, factor_config, exec_config, data_config FROM models WHERE model_id = $1',
    [model_id]
  );
  return result.rows[0];
}

async function loadCandles(symbol: AssetSymbol, tickId: Date) {
  const result = await query(
    'SELECT ts, open, high, low, close, volume FROM candles WHERE symbol = $1 AND timeframe = $2 AND source = $3 AND ts <= $4 ORDER BY ts ASC',
    [symbol, '1h', 'coinbase', tickId]
  );
  return result.rows.map((row) => ({
    symbol,
    ts: new Date(row.ts),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume)
  }));
}

function applyOrders(state: PortfolioState, orders: Array<{ symbol: AssetSymbol; side: 'BUY' | 'SELL'; qty: number; price: number; fee_usd: number }>) {
  const holdings = { ...state.holdings };
  let cash = state.cash_usd;
  for (const order of orders) {
    const notional = order.qty * order.price;
    if (order.side === 'BUY') {
      cash -= notional + order.fee_usd;
      holdings[order.symbol] = (holdings[order.symbol] ?? 0) + order.qty;
    } else {
      cash += notional - order.fee_usd;
      holdings[order.symbol] = (holdings[order.symbol] ?? 0) - order.qty;
    }
  }
  return { holdings, cash };
}

async function latestPortfolioState(portfolioId: string, modelId: string): Promise<PortfolioState | null> {
  const result = await query(
    `SELECT portfolio_id, model_id, tick_id, total_equity_usd, cash_usd, holdings, weights_current, weights_target,
            rebalance_planned, rebalance_executed
     FROM portfolio_states
     WHERE portfolio_id = $1 AND model_id = $2
     ORDER BY tick_id DESC
     LIMIT 1`,
    [portfolioId, modelId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    portfolio_id: row.portfolio_id,
    model_id: row.model_id,
    tick_id: new Date(row.tick_id),
    total_equity_usd: Number(row.total_equity_usd),
    cash_usd: Number(row.cash_usd),
    holdings: row.holdings,
    weights_current: row.weights_current,
    weights_target: row.weights_target,
    rebalance_planned: row.rebalance_planned,
    rebalance_executed: row.rebalance_executed
  };
}

async function lastTradeTick(portfolioId: string) {
  const result = await query<{ tick_id: Date }>(
    'SELECT tick_id FROM trades WHERE portfolio_id = $1 ORDER BY ts DESC LIMIT 1',
    [portfolioId]
  );
  return result.rows[0]?.tick_id ? new Date(result.rows[0].tick_id) : null;
}

app.post('/models/run', async (req, res) => {
  const { model_id, tick_id, portfolio_id } = req.body as { model_id: string; tick_id: string; portfolio_id: string };
  const tickId = new Date(tick_id);

  const existing = await query<{ run_status: string }>(
    'SELECT run_status FROM model_runs WHERE model_id = $1 AND tick_id = $2',
    [model_id, tickId]
  );
  const existingStatus = existing.rows[0]?.run_status;
  const idempotency = resolveIdempotencyStatus(existingStatus);
  if (idempotency === 'NOOP') {
    res.status(200).json({ status: 'SUCCESS', message: 'no-op' });
    return;
  }
  if (idempotency === 'CONFLICT') {
    res.status(409).json({ status: 'FAILED', message: 'model run already failed' });
    return;
  }

  const model = await loadModel(model_id);
  if (!model) {
    res.status(404).json({ error: 'model not found' });
    return;
  }

  const execConfig = model.exec_config as ExecConfig;
  const dataConfig = model.data_config as { warmup: { min_1d_days: number; min_6h_bars: number } };

  try {
    const candlesBySymbol: Record<AssetSymbol, any[]> = { BTC: [], ETH: [], ADA: [] };
    for (const symbol of SYMBOLS) {
      candlesBySymbol[symbol] = await loadCandles(symbol, tickId);
    }

    const maxTs = Math.max(
      ...Object.values(candlesBySymbol).map((candles) => candles[candles.length - 1]?.ts?.getTime() ?? 0)
    );
    const dataCutTs = new Date(maxTs > 0 ? maxTs : tickId.getTime());

    const inputsHash = hashInputs(model_id, tickId, candlesBySymbol);

    for (const symbol of SYMBOLS) {
      const agg6h = aggregateCandles(candlesBySymbol[symbol], '6h', tickId);
      const agg1d = aggregateCandles(candlesBySymbol[symbol], '1d', tickId);
      const latest6h = latestBucketEnd(tickId, '6h');
      const latest1d = latestBucketEnd(tickId, '1d');
      const hasLatest6h = agg6h.candles.some((c) => c.ts.getTime() === latest6h.getTime());
      const hasLatest1d = agg1d.candles.some((c) => c.ts.getTime() === latest1d.getTime());
      if (!hasLatest6h || !hasLatest1d) {
        await query(
          `INSERT INTO model_runs (model_id, tick_id, run_status, data_cut_ts, inputs_hash, started_at, completed_at, error)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
          , [model_id, tickId, 'SKIPPED', dataCutTs, inputsHash, new Date(), new Date(), 'missing required candles']
        );
        res.status(200).json({ status: 'SKIPPED', reason: 'missing required candles' });
        return;
      }

      if (agg6h.candles.length < dataConfig.warmup.min_6h_bars || agg1d.candles.length < dataConfig.warmup.min_1d_days) {
        await query(
          `INSERT INTO model_runs (model_id, tick_id, run_status, data_cut_ts, inputs_hash, started_at, completed_at, error)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
          , [model_id, tickId, 'WARMUP', dataCutTs, inputsHash, new Date(), new Date(), 'warmup window not satisfied']
        );
        res.status(200).json({ status: 'WARMUP' });
        return;
      }
    }

    const { signals, allocation } = computeSignals(candlesBySymbol, tickId, model.factor_config);

    const priceMap: Record<AssetSymbol, number> = {
      BTC: candlesBySymbol.BTC[candlesBySymbol.BTC.length - 1]?.close ?? 0,
      ETH: candlesBySymbol.ETH[candlesBySymbol.ETH.length - 1]?.close ?? 0,
      ADA: candlesBySymbol.ADA[candlesBySymbol.ADA.length - 1]?.close ?? 0
    };

    const previousState = await latestPortfolioState(portfolio_id, model_id);
    const baseState: PortfolioState = previousState ?? {
      portfolio_id,
      model_id,
      tick_id: tickId,
      total_equity_usd: 10000,
      cash_usd: 10000,
      holdings: { BTC: 0, ETH: 0, ADA: 0 },
      weights_current: { BTC: 0, ETH: 0, ADA: 0, CASH: 1 },
      weights_target: { BTC: 0, ETH: 0, ADA: 0, CASH: 1 },
      rebalance_planned: false,
      rebalance_executed: false
    };

    const equity = baseState.cash_usd +
      SYMBOLS.reduce((sum, symbol) => sum + (baseState.holdings[symbol] ?? 0) * priceMap[symbol], 0);

    const lastTrade = await lastTradeTick(portfolio_id);
    const cooldownCycles = execConfig.cooldown_cycles;
    const allowTrade = !lastTrade || (tickId.getTime() - lastTrade.getTime()) / SIX_HOURS_MS > cooldownCycles;

    const plan = planRebalance(
      { equity, cash: baseState.cash_usd, holdings: baseState.holdings },
      allocation.weights,
      priceMap,
      execConfig,
      allowTrade
    );

    const { holdings, cash } = applyOrders(baseState, plan.orders);
    const totalEquity = cash + SYMBOLS.reduce((sum, symbol) => sum + (holdings[symbol] ?? 0) * priceMap[symbol], 0);

    const weightsCurrent = {
      BTC: totalEquity === 0 ? 0 : (holdings.BTC * priceMap.BTC) / totalEquity,
      ETH: totalEquity === 0 ? 0 : (holdings.ETH * priceMap.ETH) / totalEquity,
      ADA: totalEquity === 0 ? 0 : (holdings.ADA * priceMap.ADA) / totalEquity,
      CASH: totalEquity === 0 ? 1 : cash / totalEquity
    };

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO model_runs (model_id, tick_id, run_status, data_cut_ts, inputs_hash, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`
        , [model_id, tickId, 'SUCCESS', dataCutTs, inputsHash, new Date(), new Date()]
      );

      for (const signal of signals) {
        await client.query(
          `INSERT INTO signals (model_id, tick_id, symbol, asset_score, signal, confidence, factor_breakdown)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [model_id, tickId, signal.symbol, signal.asset_score, signal.signal, signal.confidence, signal.factor_breakdown]
        );
      }

      await client.query(
        `INSERT INTO portfolio_states
          (portfolio_id, model_id, tick_id, total_equity_usd, cash_usd, holdings, weights_current, weights_target, rebalance_planned, rebalance_executed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          portfolio_id,
          model_id,
          tickId,
          totalEquity,
          cash,
          holdings,
          weightsCurrent,
          allocation.weights,
          plan.planned,
          plan.orders.length > 0
        ]
      );

      for (const order of plan.orders) {
        await client.query(
          `INSERT INTO trades
            (trade_id, portfolio_id, model_id, tick_id, ts, symbol, side, qty, price, notional_usd, fee_usd, slippage_bps, order_type, reason, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            uuidv4(),
            portfolio_id,
            model_id,
            tickId,
            new Date(),
            order.symbol,
            order.side,
            order.qty,
            order.price,
            order.notional_usd,
            order.fee_usd,
            order.slippage_bps,
            'MARKET',
            order.reason,
            order.metadata
          ]
        );
      }
    });

    res.status(200).json({ status: 'SUCCESS', orders: plan.orders.length, portfolio_id });
  } catch (error: any) {
    await query(
      `INSERT INTO model_runs (model_id, tick_id, run_status, data_cut_ts, inputs_hash, started_at, completed_at, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
      , [model_id, tickId, 'FAILED', tickId, 'unknown', new Date(), new Date(), error?.message ?? 'unknown error']
    );
    res.status(500).json({ status: 'FAILED', error: error?.message ?? 'unknown error' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8082);
app.listen(port, () => {
  console.log(`model-runner listening on ${port}`);
});
