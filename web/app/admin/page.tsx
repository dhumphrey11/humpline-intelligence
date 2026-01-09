import { getAdminHealth } from '../../lib/api';

export default async function AdminPage() {
  const healthResponse = await getAdminHealth();
  const health = healthResponse ?? { ticks: [], ingestion_runs: [], last_candles: [] };

  return (
    <section className="grid">
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Model Flags</div>
          <p>Admin endpoints are protected by Google Identity / IAP.</p>
          <div className="pill">POST /api/admin/models/:model_id/set_active</div>
          <div className="pill">POST /api/admin/models/:model_id/set_contender</div>
        </div>
        <div className="card">
          <div className="label">Last Candle Per Symbol</div>
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Last TS</th>
              </tr>
            </thead>
            <tbody>
              {health.last_candles.map((row: any, index: number) => (
                <tr key={`${row.symbol ?? index}`}>
                  <td>{row.symbol ?? '—'}</td>
                  <td>{row.last_ts ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Recent Ticks</div>
          <table className="table">
            <thead>
              <tr>
                <th>Tick</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {health.ticks.map((tick: any, index: number) => (
                <tr key={`${tick.tick_id ?? index}`}>
                  <td>{tick.tick_id ?? '—'}</td>
                  <td>{tick.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="label">Ingestion Runs</div>
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {health.ingestion_runs.map((run: any, index: number) => (
                <tr key={`${run.run_id ?? index}`}>
                  <td>{run.started_at ?? '—'}</td>
                  <td>{run.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
