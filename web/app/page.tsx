import { getAdminHealth, getCurrentPortfolio, getPerformance, getTrades, getPortfolioStates, getActionLogs } from '../lib/api';
import { MiniChart } from '../components/mini-chart';
import { SignalBadge } from '../components/signal-badge';
import { formatUtc } from '../lib/format';

function formatPct(value: number) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export default async function DashboardPage() {
  const [portfolio, perf, recentStatesRaw, tradesResponse, health, actionLogs] = await Promise.all([
    getCurrentPortfolio(),
    getPerformance('30d'),
    getPortfolioStates(5),
    getTrades(20),
    getAdminHealth(),
    getActionLogs()
  ]);

  const recentStates = Array.isArray(recentStatesRaw) ? recentStatesRaw : [];
  const trades = Array.isArray(tradesResponse) ? tradesResponse : [];
  const weightsCurrent = portfolio?.state?.weights_current ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const weightsTarget = portfolio?.state?.weights_target ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const signals = Array.isArray(portfolio?.signals) ? portfolio?.signals : [];
  const holdings = portfolio?.state?.holdings ?? {};
  const equity = Number(portfolio?.state?.total_equity_usd ?? 0);
  return (
    <section className="grid">
      <div className="grid cols-3">
        <div className="card">
          <div className="label">Total Equity</div>
          <div className="stat">${equity.toLocaleString()}</div>
          <div className="pill">As of {formatUtc(portfolio?.state?.tick_id)}</div>
        </div>
        <div className="card">
          <div className="label">30D Return</div>
          <div className="stat">{formatPct(perf?.metrics?.return_pct ?? 0)}</div>
        </div>
        <div className="card">
          <div className="label">Health</div>
          <p className="footer-note">Latest tick: {health?.ticks?.[0]?.status ?? '—'} @ {formatUtc(health?.ticks?.[0]?.tick_id)}</p>
          <p className="footer-note">Latest ingestion: {health?.ingestion_runs?.[0]?.status ?? '—'} @ {formatUtc(health?.ingestion_runs?.[0]?.started_at)}</p>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Allocations (Current vs Target)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Current</th>
                <th>Target</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {['BTC', 'ETH', 'ADA', 'CASH'].map((asset) => (
                <tr key={asset}>
                  <td>{asset}</td>
                  <td>{(Number(weightsCurrent[asset as keyof typeof weightsCurrent]) * 100).toFixed(1)}%</td>
                  <td>{(Number(weightsTarget[asset as keyof typeof weightsTarget]) * 100).toFixed(1)}%</td>
                  <td>{Number(holdings[asset]).toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="label">Signals</div>
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Signal</th>
                <th>Score</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((signal: any) => (
                <tr key={signal.symbol}>
                  <td>{signal.symbol}</td>
                  <td><SignalBadge signal={signal.signal} /></td>
                  <td>{Number(signal.asset_score ?? 0).toFixed(2)}</td>
                  <td>{signal.confidence ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="label">Recent Actions</div>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Source</th>
              <th>Action</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(actionLogs ?? []).map((row: any) => (
              <tr key={row.id}>
                <td>{formatUtc(row.created_at)}</td>
                <td>{row.actor ?? '—'}</td>
                <td>{row.source ?? '—'}</td>
                <td>{row.action ?? '—'}</td>
                <td>{row.status ?? '—'}</td>
                <td><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(row.detail ?? {}, null, 2)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
