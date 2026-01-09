import { getModels } from '../../lib/api';

export default async function ModelsPage() {
  const modelsResponse = await getModels();
  const models = Array.isArray(modelsResponse) ? modelsResponse : [];

  return (
    <section className="grid">
      <div className="card">
        <div className="label">Models</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Active</th>
              <th>Contender</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model: any) => (
              <tr key={model.model_id}>
                <td>{model.model_id}</td>
                <td>{model.model_name}</td>
                <td>{model.is_active ? 'Yes' : 'No'}</td>
                <td>{model.is_contender ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="label">Model Detail</div>
          <p>Select a model in the API UI to load configs, performance snapshots, and backtest metadata.</p>
          <div className="pill">Configs include factor, exec, and data settings.</div>
        </div>
        <div className="card">
          <div className="label">Backtest Baseline</div>
          <p>Attach backtest artifacts in the API for compliance-ready comparisons.</p>
        </div>
      </div>
    </section>
  );
}
