import { getEquityCurves, getMonitoring } from '../../lib/api';
import { MiniChart } from '../../components/mini-chart';

export default async function MonitoringPage() {
  const leaderboardResponse = await getMonitoring('90d');
  const leaderboard = Array.isArray(leaderboardResponse) ? leaderboardResponse : [];
  const equityResponse = await getEquityCurves(['1.0.0'], 180);
  const equity = Array.isArray(equityResponse) ? equityResponse : [];
  const equitySeries = equity.slice(-10).map((row: any) => Number(row.total_equity_usd ?? 0));

  return (
    <section className="grid">
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Leaderboard (90D)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Return</th>
                <th>Drawdown</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row: any, index: number) => (
                <tr key={`${row.model_id ?? index}`}>
                  <td>{row.model_id ?? '—'}</td>
                  <td>{row.metrics?.return_pct ? `${(Number(row.metrics.return_pct) * 100).toFixed(2)}%` : '—'}</td>
                  <td>{row.metrics?.max_drawdown ? `${(Number(row.metrics.max_drawdown) * 100).toFixed(2)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="label">Equity Curve (180D)</div>
          {equitySeries.length ? (
            <MiniChart points={equitySeries} stroke="#c95c3c" />
          ) : (
            <p className="footer-note">Equity curve appears after model runs complete.</p>
          )}
        </div>
      </div>
      <div className="card">
        <div className="label">Alerts</div>
        <p>Alerts list is derived from failed ticks and ingestion anomalies. Use the admin panel for details.</p>
      </div>
    </section>
  );
}
