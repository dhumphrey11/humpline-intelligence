const API_BASE = process.env.API_BASE ?? 'http://localhost:8085';

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
    if (!response.ok) {
      return fallback;
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

export async function getCurrentPortfolio() {
  return safeFetch('/api/portfolio/current', {
    portfolio_id: 'paper_1.0.0',
    model_id: '1.0.0',
    state: {
      tick_id: new Date().toISOString(),
      total_equity_usd: 10000,
      cash_usd: 10000,
      weights_current: { BTC: 0, ETH: 0, ADA: 0, CASH: 1 },
      weights_target: { BTC: 0.4, ETH: 0.3, ADA: 0.1, CASH: 0.2 }
    },
    signals: [
      { symbol: 'BTC', signal: 'BUY', confidence: 82, asset_score: 0.42 },
      { symbol: 'ETH', signal: 'HOLD', confidence: 58, asset_score: 0.05 },
      { symbol: 'ADA', signal: 'SELL', confidence: 65, asset_score: -0.22 }
    ],
    llm: { content: 'LLM commentary placeholder for the active model.' }
  });
}

export async function getPerformance(range: string) {
  return safeFetch(`/api/portfolio/performance?range=${range}`, {
    metrics: { return_pct: 0.05, max_drawdown: 0.02, volatility: 0.01 },
    as_of: new Date().toISOString()
  });
}

export async function getTrades(limit = 20) {
  return safeFetch(`/api/portfolio/transactions?limit=${limit}`, [] as Array<Record<string, any>>);
}

export async function getModels() {
  return safeFetch('/api/models', [] as Array<Record<string, any>>);
}

export async function getMonitoring(range: string) {
  return safeFetch(`/api/monitor/leaderboard?range=${range}`, [] as Array<Record<string, any>>);
}

export async function getEquityCurves(modelIds: string[], range: number) {
  if (modelIds.length === 0) {
    return [];
  }
  const encoded = encodeURIComponent(modelIds.join(','));
  return safeFetch(`/api/monitor/equity_curves?model_ids=${encoded}&range=${range}`, [] as Array<Record<string, any>>);
}

export async function getTransactions(filters: string) {
  return safeFetch(`/api/trades?${filters}`, [] as Array<Record<string, any>>);
}

export async function getAdminHealth() {
  return safeFetch('/api/admin/system/health', { ticks: [], ingestion_runs: [], last_candles: [] });
}
