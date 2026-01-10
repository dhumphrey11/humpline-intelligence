import { getEquityCurves, getMonitoring, getPerformance } from '../../lib/api';
import { MiniChart } from '../../components/mini-chart';

export default async function PerformancePage() {
  const perf = await getPerformance('90d');
  const leaderboardResponse = await getMonitoring('90d');
  const leaderboard = Array.isArray(leaderboardResponse) ? leaderboardResponse : [];
  const equityResponse = await getEquityCurves(['1.0.0'], 180);
  const equity = Array.isArray(equityResponse) ? equityResponse : [];
  const equitySeries = equity.slice(-30).map((row: any) => Number(row.total_equity_usd ?? 0));

  return (
    <section className="grid">
      <div className="grid cols-3">
        <div className="card">
          <div className="label">Return (90D)</div>
          <div className="stat">{((perf?.metrics?.return_pct ?? 0) * 100).toFixed(2)}%</div>
        </div>
        <div className="card">
          <div className="label">Drawdown Threshold</div>
          <p className="footer-note">Placeholder: alert when &gt; 15%</p>
        </div>
        <div className="card">
          <div className="label">Volatility Threshold</div>
          <p className="footer-note">Placeholder: alert when &gt; target band</p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="label">Equity Curve (180D)</div>
          {equitySeries.length ? <MiniChart points={equitySeries} stroke="#38bdf8" /> : <p className="footer-note">Equity curve appears after model runs complete.</p>}
        </div>
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
      </div>
    </section>
  );
}
