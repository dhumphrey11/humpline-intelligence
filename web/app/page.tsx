import { getCurrentPortfolio, getPerformance, getTrades, getPortfolioStates } from '../lib/api';
import { MiniChart } from '../components/mini-chart';
import { SignalBadge } from '../components/signal-badge';

export default async function CurrentPortfolioPage() {
  const data = await getCurrentPortfolio();
  const perf = await getPerformance('30d');
  const recentStates = (await getPortfolioStates(5)) ?? [];
  const tradesResponse = await getTrades(20);
  const trades = Array.isArray(tradesResponse) ? tradesResponse : [];
  const weightsCurrent = data?.state?.weights_current ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const weightsTarget = data?.state?.weights_target ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const equitySeries: number[] = [];
  const signals = Array.isArray(data?.signals) ? data?.signals : [];
  const holdings = data?.state?.holdings ?? {};

  return (
    <section className="grid">
      <div className="grid cols-3">
        <div className="card">
          <div className="label">Total Equity</div>
          <div className="stat">${Number(data?.state?.total_equity_usd ?? 0).toLocaleString()}</div>
          <div className="pill">As of {data?.state?.tick_id ?? '—'}</div>
        </div>
        <div className="card">
          <div className="label">30D Return</div>
          <div className="stat">{(Number(perf?.metrics?.return_pct ?? 0) * 100).toFixed(2)}%</div>
          {equitySeries.length > 0 ? (
            <MiniChart points={equitySeries} />
          ) : (
            <p className="footer-note">Equity curve will appear after multiple ticks.</p>
          )}
        </div>
        <div className="card">
          <div className="label">LLM Commentary</div>
          <p>{data?.llm?.content ?? 'No commentary yet.'}</p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="label">Weights Current vs Target</div>
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Current</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {['BTC', 'ETH', 'ADA', 'CASH'].map((asset) => (
                <tr key={asset}>
                  <td>{asset}</td>
                  <td>{(Number(weightsCurrent[asset as keyof typeof weightsCurrent]) * 100).toFixed(1)}%</td>
                  <td>{(Number(weightsTarget[asset as keyof typeof weightsTarget]) * 100).toFixed(1)}%</td>
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

      <div className="grid cols-2">
        <div className="card">
          <div className="label">Current Positions</div>
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(holdings).map((asset) => (
                <tr key={asset}>
                  <td>{asset}</td>
                  <td>{Number(holdings[asset]).toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="label">Recent Target Vectors</div>
          <table className="table">
            <thead>
              <tr>
                <th>Tick</th>
                <th>Weights</th>
              </tr>
            </thead>
            <tbody>
              {recentStates.map((row, index) => (
                <tr key={`${row.tick_id ?? index}`}>
                  <td>{row.tick_id}</td>
                  <td>{JSON.stringify(row.weights_target)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="label">Last 20 Trades</div>
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
            {trades.map((trade: any, index: number) => (
              <tr key={`${trade.trade_id ?? index}`}>
                <td>{trade.ts ?? '—'}</td>
                <td>{trade.symbol ?? '—'}</td>
                <td>{trade.side ?? '—'}</td>
                <td>{trade.qty ? Number(trade.qty).toFixed(4) : '—'}</td>
                <td>{trade.notional_usd ? Number(trade.notional_usd).toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
