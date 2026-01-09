import { getEquityCurves, getMonitoring } from '../../lib/api';
import { MiniChart } from '../../components/mini-chart';

export default async function MonitoringPage() {
  const leaderboard = await getMonitoring('90d');
  const equity = await getEquityCurves(['1.0.0'], 180);
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
          <MiniChart points={equitySeries.length ? equitySeries : [10000, 10150, 10220, 10180, 10340]} stroke="#c95c3c" />
        </div>
      </div>
      <div className="card">
        <div className="label">Alerts</div>
        <p>Alerts list is derived from failed ticks and ingestion anomalies. Use the admin panel for details.</p>
      </div>
    </section>
  );
}
