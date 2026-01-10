import { getAdminDataOverview, getCurrentUser } from '../../../lib/api';

export default async function AdminDataPage() {
  const user = await getCurrentUser();
  const role = user?.role ?? 'guest';
  if (role !== 'admin') {
    return (
      <section className="grid">
        <div className="card">
          <div className="label">Admin Access</div>
          <div className="stat">Access denied</div>
          <p className="footer-note">Admin-only data explorer.</p>
        </div>
      </section>
    );
  }

  const data = await getAdminDataOverview();
  const candles = data?.recent_candles ?? [];
  const signals = data?.recent_signals ?? [];
  const trades = data?.recent_trades ?? [];
  const portfolios = data?.recent_portfolios ?? [];

  return (
    <section className="grid">
      <div className="card">
        <div className="label">Recent Candles (1H)</div>
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Close TS</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {candles.map((row, index) => (
              <tr key={`${row.symbol}-${row.ts}-${index}`}>
                <td>{row.symbol}</td>
                <td>{row.ts}</td>
                <td>{Number(row.open).toFixed(2)}</td>
                <td>{Number(row.high).toFixed(2)}</td>
                <td>{Number(row.low).toFixed(2)}</td>
                <td>{Number(row.close).toFixed(2)}</td>
                <td>{Number(row.volume).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="label">Recent Signals</div>
          <table className="table">
            <thead>
              <tr>
                <th>Tick</th>
                <th>Model</th>
                <th>Symbol</th>
                <th>Signal</th>
                <th>Score</th>
                <th>Conf</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((row, index) => (
                <tr key={`${row.model_id}-${row.symbol}-${row.tick_id}-${index}`}>
                  <td>{row.tick_id}</td>
                  <td>{row.model_id}</td>
                  <td>{row.symbol}</td>
                  <td>{row.signal}</td>
                  <td>{Number(row.asset_score).toFixed(2)}</td>
                  <td>{row.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="label">Recent Trades</div>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Notional</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((row, index) => (
                <tr key={`${row.trade_id}-${index}`}>
                  <td>{row.ts}</td>
                  <td>{row.symbol}</td>
                  <td>{row.side}</td>
                  <td>{Number(row.qty).toFixed(4)}</td>
                  <td>{Number(row.notional_usd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="label">Recent Portfolio States</div>
        <table className="table">
          <thead>
            <tr>
              <th>Tick</th>
              <th>Portfolio</th>
              <th>Equity</th>
              <th>Cash</th>
              <th>Weights Current</th>
              <th>Weights Target</th>
            </tr>
          </thead>
          <tbody>
            {portfolios.map((row, index) => (
              <tr key={`${row.portfolio_id}-${row.tick_id}-${index}`}>
                <td>{row.tick_id}</td>
                <td>{row.portfolio_id}</td>
                <td>${Number(row.total_equity_usd).toLocaleString()}</td>
                <td>${Number(row.cash_usd).toLocaleString()}</td>
                <td>{JSON.stringify(row.weights_current)}</td>
                <td>{JSON.stringify(row.weights_target)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
