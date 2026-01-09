export type AssetSymbol = 'BTC' | 'ETH' | 'ADA';
export type PortfolioSymbol = AssetSymbol | 'CASH';

export interface Candle {
  symbol: AssetSymbol;
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AggregatedCandle extends Candle {
  timeframe: '6h' | '1d';
}

export interface ModelConfig {
  model_id: string;
  model_name: string;
  is_active: boolean;
  is_contender: boolean;
  universe: AssetSymbol[];
  decision_frequency: '6h';
  factor_config: FactorConfig;
  exec_config: ExecConfig;
  data_config: DataConfig;
  notes?: string | null;
}

export interface DataConfig {
  source: 'coinbase';
  storage_timeframe: '1h';
  derived_timeframes: Array<'6h' | '1d'>;
  candle_ts: 'close_time';
  timezone: 'UTC';
  warmup: {
    min_1d_days: number;
    min_6h_bars: number;
  };
}

export interface FactorConfig {
  trend_weight: number;
  momentum_weight: number;
  vol_weight: number;
  signal_threshold_buy: number;
  signal_threshold_sell: number;
}

export interface ExecConfig {
  paper_only: true;
  order_type: 'MARKET';
  rebalance_band: number;
  min_trade_usd: number;
  cooldown_cycles: number;
  high_urgency_conf: number;
  fee_bps: number;
  slippage_bps: Record<AssetSymbol, number>;
}

export interface FactorOutputs {
  trend: number;
  momentum: number;
  volatility: number;
}

export interface SignalOutput {
  symbol: AssetSymbol;
  asset_score: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence: number;
  factor_breakdown: FactorOutputs;
}

export interface PortfolioState {
  portfolio_id: string;
  model_id: string;
  tick_id: Date;
  total_equity_usd: number;
  cash_usd: number;
  holdings: Record<AssetSymbol, number>;
  weights_current: Record<PortfolioSymbol, number>;
  weights_target: Record<PortfolioSymbol, number>;
  rebalance_planned: boolean;
  rebalance_executed: boolean;
}

export interface TradeOrder {
  symbol: AssetSymbol;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  notional_usd: number;
  fee_usd: number;
  slippage_bps: number;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface AllocationResult {
  weights: Record<PortfolioSymbol, number>;
  desirability: Record<AssetSymbol, number>;
}

export interface RebalancePlan {
  planned: boolean;
  orders: TradeOrder[];
}

export interface ModelRunResult {
  signals: SignalOutput[];
  target_weights: Record<PortfolioSymbol, number>;
  portfolio_state: PortfolioState;
  trades: TradeOrder[];
  data_cut_ts: Date;
  inputs_hash: string;
  run_status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WARMUP';
  error?: string | null;
}
