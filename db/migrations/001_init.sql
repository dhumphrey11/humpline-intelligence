-- Initial schema for humpline-intelligence
CREATE TABLE IF NOT EXISTS ticks (
  tick_id timestamptz PRIMARY KEY,
  status text NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  notes text
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id uuid PRIMARY KEY,
  service text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  details jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS ingestion_runs_started_at_idx
  ON ingestion_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS ingestion_runs_status_started_at_idx
  ON ingestion_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS candles (
  symbol text NOT NULL,
  timeframe text NOT NULL,
  ts timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric NOT NULL,
  source text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candles_timeframe_check CHECK (timeframe = '1h'),
  CONSTRAINT candles_symbol_check CHECK (symbol IN ('BTC', 'ETH', 'ADA')),
  CONSTRAINT candles_unique UNIQUE (symbol, timeframe, ts, source)
);

CREATE INDEX IF NOT EXISTS candles_symbol_ts_idx
  ON candles (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS models (
  model_id text PRIMARY KEY,
  model_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  is_contender boolean NOT NULL DEFAULT false,
  universe jsonb NOT NULL,
  decision_frequency text NOT NULL,
  factor_config jsonb NOT NULL,
  exec_config jsonb NOT NULL,
  data_config jsonb NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS model_runs (
  model_id text NOT NULL REFERENCES models(model_id),
  tick_id timestamptz NOT NULL REFERENCES ticks(tick_id),
  run_status text NOT NULL,
  data_cut_ts timestamptz NOT NULL,
  inputs_hash text NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  CONSTRAINT model_runs_unique UNIQUE (model_id, tick_id)
);

CREATE TABLE IF NOT EXISTS llm_explanations (
  id uuid PRIMARY KEY,
  model_id text NOT NULL,
  tick_id timestamptz NOT NULL,
  content text NOT NULL,
  flags jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals (
  model_id text NOT NULL REFERENCES models(model_id),
  tick_id timestamptz NOT NULL REFERENCES ticks(tick_id),
  symbol text NOT NULL,
  asset_score numeric NOT NULL,
  signal text NOT NULL,
  confidence int NOT NULL,
  factor_breakdown jsonb NOT NULL,
  llm_explanation_id uuid REFERENCES llm_explanations(id),
  CONSTRAINT signals_unique UNIQUE (model_id, tick_id, symbol)
);

CREATE INDEX IF NOT EXISTS signals_model_tick_idx
  ON signals (model_id, tick_id DESC);
CREATE INDEX IF NOT EXISTS signals_symbol_tick_idx
  ON signals (symbol, tick_id DESC);

CREATE TABLE IF NOT EXISTS portfolio_states (
  portfolio_id text NOT NULL,
  model_id text NOT NULL,
  tick_id timestamptz NOT NULL,
  total_equity_usd numeric NOT NULL,
  cash_usd numeric NOT NULL,
  holdings jsonb NOT NULL,
  weights_current jsonb NOT NULL,
  weights_target jsonb NOT NULL,
  rebalance_planned boolean NOT NULL,
  rebalance_executed boolean NOT NULL,
  CONSTRAINT portfolio_states_unique UNIQUE (portfolio_id, model_id, tick_id)
);

CREATE INDEX IF NOT EXISTS portfolio_states_portfolio_tick_idx
  ON portfolio_states (portfolio_id, tick_id DESC);

CREATE TABLE IF NOT EXISTS trades (
  trade_id uuid PRIMARY KEY,
  portfolio_id text NOT NULL,
  model_id text NOT NULL,
  tick_id timestamptz NOT NULL,
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  qty numeric NOT NULL,
  price numeric NOT NULL,
  notional_usd numeric NOT NULL,
  fee_usd numeric NOT NULL,
  slippage_bps int NOT NULL,
  order_type text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS trades_portfolio_ts_idx
  ON trades (portfolio_id, ts DESC);
CREATE INDEX IF NOT EXISTS trades_model_ts_idx
  ON trades (model_id, ts DESC);
CREATE INDEX IF NOT EXISTS trades_symbol_ts_idx
  ON trades (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  model_id text NOT NULL,
  portfolio_id text NOT NULL,
  as_of timestamptz NOT NULL,
  "window" text NOT NULL,
  metrics jsonb NOT NULL,
  CONSTRAINT performance_snapshots_unique UNIQUE (model_id, portfolio_id, as_of, "window")
);

CREATE TABLE IF NOT EXISTS backtests (
  model_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  assumptions jsonb NOT NULL,
  results jsonb NOT NULL,
  equity_curve_ref text
);
