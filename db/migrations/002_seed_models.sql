INSERT INTO models (
  model_id,
  model_name,
  is_active,
  is_contender,
  universe,
  decision_frequency,
  factor_config,
  exec_config,
  data_config,
  notes
)
VALUES (
  '1.0.0',
  'T1 OHLCV MVP',
  true,
  false,
  '["BTC","ETH","ADA"]'::jsonb,
  '6h',
  '{
    "trend_weight": 0.45,
    "momentum_weight": 0.35,
    "vol_weight": 0.20,
    "signal_threshold_buy": 0.20,
    "signal_threshold_sell": -0.20
  }'::jsonb,
  '{
    "paper_only": true,
    "order_type": "MARKET",
    "rebalance_band": 0.05,
    "min_trade_usd": 200,
    "cooldown_cycles": 1,
    "high_urgency_conf": 85,
    "fee_bps": 10,
    "slippage_bps": {
      "BTC": 5,
      "ETH": 5,
      "ADA": 10
    }
  }'::jsonb,
  '{
    "source": "coinbase",
    "storage_timeframe": "1h",
    "derived_timeframes": ["6h", "1d"],
    "candle_ts": "close_time",
    "timezone": "UTC",
    "warmup": {
      "min_1d_days": 240,
      "min_6h_bars": 180
    }
  }'::jsonb,
  'Locked production model for MVP'
)
ON CONFLICT (model_id) DO NOTHING;
