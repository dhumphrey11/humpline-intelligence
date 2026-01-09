import { getCurrentPortfolio, getPerformance, getTrades } from '../lib/api';
import { MiniChart } from '../components/mini-chart';
import { SignalBadge } from '../components/signal-badge';

export default async function CurrentPortfolioPage() {
  const data = await getCurrentPortfolio();
  const perf = await getPerformance('30d');
  const trades = await getTrades(20);
  const weightsCurrent = data.state?.weights_current ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const weightsTarget = data.state?.weights_target ?? { BTC: 0, ETH: 0, ADA: 0, CASH: 1 };
  const equitySeries = [10000, 10050, 10120, 10080, 10240, 10310, 10420, 10390];

  return (
    <section className="grid">
      <div className="grid cols-3">
        <div className="card">
          <div className="label">Total Equity</div>
          <div className="stat">${Number(data.state?.total_equity_usd ?? 10000).toLocaleString()}</div>
          <div className="pill">As of {new Date(data.state?.tick_id ?? Date.now()).toISOString()}</div>
        </div>
        <div className="card">
          <div className="label">30D Return</div>
          <div className="stat">{(Number(perf.metrics?.return_pct ?? 0) * 100).toFixed(2)}%</div>
          <MiniChart points={equitySeries} />
        </div>
        <div className="card">
          <div className="label">LLM Commentary</div>
          <p>{data.llm?.content ?? 'No commentary yet.'}</p>
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
              {data.signals.map((signal: any) => (
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
