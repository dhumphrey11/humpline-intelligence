import { getModels, getMonitoring } from '../../lib/api';

export default async function ModelsPage() {
  const [modelsResponse, leaderboardResponse] = await Promise.all([
    getModels(),
    getMonitoring('90d')
  ]);
  const models = Array.isArray(modelsResponse) ? modelsResponse : [];
  const leaderboard = Array.isArray(leaderboardResponse) ? leaderboardResponse : [];
  const metricByModel = new Map<string, any>();
  leaderboard.forEach((row: any) => metricByModel.set(row.model_id, row));

  return (
    <section className="grid">
      <div className="card">
        <div className="label">Models</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Return (90D)</th>
              <th>Drawdown</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model: any) => {
              const metric = metricByModel.get(model.model_id);
              return (
                <tr key={model.model_id}>
                  <td>{model.model_id}</td>
                  <td>{model.model_name}</td>
                  <td>
                    {model.is_active ? 'Active' : model.is_contender ? 'Contender' : 'Retired'}
                  </td>
                  <td>
                    {metric?.metrics?.return_pct
                      ? `${(Number(metric.metrics.return_pct) * 100).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td>
                    {metric?.metrics?.max_drawdown
                      ? `${(Number(metric.metrics.max_drawdown) * 100).toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Model Detail</div>
          <p>Configs (factor/exec/data) and backtest metadata are exposed via API for deep dives.</p>
          <div className="pill">Active model drives the production portfolio.</div>
          <div className="pill">Contenders run every tick for comparison.</div>
        </div>
        <div className="card">
          <div className="label">Backtest Baseline</div>
          <p>Attach backtest artifacts in the API for compliance-ready comparisons.</p>
        </div>
      </div>
    </section>
  );
}
