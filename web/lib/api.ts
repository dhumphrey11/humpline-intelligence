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

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export async function getCurrentPortfolio() {
  return safeFetch('/api/portfolio/current');
}

export async function getPerformance(range: string) {
  return safeFetch(`/api/portfolio/performance?range=${range}`);
}

export async function getTrades(limit = 20) {
  return safeFetch(`/api/portfolio/transactions?limit=${limit}`);
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

export async function getApiHealth(): Promise<ApiHealth | null> {
  return safeFetch<ApiHealth>('/health');
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return safeFetch<CurrentUser>('/api/me');
}
