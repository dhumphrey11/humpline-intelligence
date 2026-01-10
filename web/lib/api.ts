import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8085';

export type CurrentUser = {
  email: string | null;
  role: 'admin' | 'guest';
};

export type AdminHealth = {
  ticks: Array<{ tick_id: string; status: string }>;
  ingestion_runs: Array<{ run_id: string; started_at: string; status: string }>;
  last_candles: Array<{ symbol: string; last_ts: string }>;
};

export type ApiHealth = {
  status: string;
};

export type AdminDataOverview = {
  recent_candles: Array<{
    symbol: string;
    ts: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
  recent_signals: Array<{
    model_id: string;
    tick_id: string;
    symbol: string;
    asset_score: string;
    signal: string;
    confidence: number;
  }>;
  recent_trades: Array<{
    trade_id: string;
    portfolio_id: string;
    model_id: string;
    ts: string;
    symbol: string;
    side: string;
    qty: string;
    notional_usd: string;
  }>;
  recent_portfolios: Array<{
    portfolio_id: string;
    model_id: string;
    tick_id: string;
    total_equity_usd: string;
    cash_usd: string;
    weights_current: Record<string, number>;
    weights_target: Record<string, number>;
  }>;
};

export type PortfolioState = {
  tick_id: string;
  total_equity_usd: number;
  weights_current: Record<string, number>;
  weights_target: Record<string, number>;
};

export type PortfolioSignal = {
  symbol: string;
  signal: string;
  asset_score: number;
  confidence: number;
};

export type PortfolioResponse = {
  state: PortfolioState;
  signals: PortfolioSignal[];
  llm?: { content: string };
};

export type PerformanceResponse = {
  metrics: { return_pct: number };
};

export type Trade = {
  trade_id: string;
  ts: string;
  symbol: string;
  side: string;
  qty: number;
  notional_usd: number;
};

function getAuthHeaders() {
  try {
    // Server-only access to the auth cookie for API calls.
    const token = cookies().get('humpline_id_token')?.value;
    if (!token) {
      return undefined;
    }
    return { Authorization: `Bearer ${token}` } as Record<string, string>;
  } catch {
    return undefined;
  }
}

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 30 },
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export async function getCurrentPortfolio(): Promise<PortfolioResponse | null> {
  return safeFetch<PortfolioResponse>('/api/portfolio/current');
}

export async function getPerformance(range: string): Promise<PerformanceResponse | null> {
  return safeFetch<PerformanceResponse>(`/api/portfolio/performance?range=${range}`);
}

export async function getTrades(limit = 20): Promise<Trade[] | null> {
  return safeFetch<Trade[]>(`/api/portfolio/transactions?limit=${limit}`);
}

export async function getModels() {
  return safeFetch('/api/models');
}

export async function getMonitoring(range: string) {
  return safeFetch(`/api/monitor/leaderboard?range=${range}`);
}

export async function getEquityCurves(modelIds: string[], range: number) {
  if (modelIds.length === 0) {
    return [];
  }
  const encoded = encodeURIComponent(modelIds.join(','));
  return safeFetch(`/api/monitor/equity_curves?model_ids=${encoded}&range=${range}`);
}

export async function getTransactions(filters: string) {
  return safeFetch(`/api/trades?${filters}`);
}

export async function getAdminHealth(): Promise<AdminHealth | null> {
  return safeFetch<AdminHealth>('/api/admin/system/health');
}

export async function getAdminDataOverview(): Promise<AdminDataOverview | null> {
  return safeFetch<AdminDataOverview>('/api/admin/data/overview');
}

export async function getApiHealth(): Promise<ApiHealth | null> {
  return safeFetch<ApiHealth>('/health');
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return safeFetch<CurrentUser>('/api/me');
}
