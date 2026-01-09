import { getTransactions } from '../../lib/api';

export default async function TransactionsPage() {
  const tradesResponse = await getTransactions('limit=50');
  const trades = Array.isArray(tradesResponse) ? tradesResponse : [];

  return (
    <section className="grid">
      <div className="card">
        <div className="label">Filters</div>
        <p>Filter by model_id, symbol, side, and date range via query parameters.</p>
        <div className="pill">Example: ?model_id=1.0.0&symbol=BTC&side=BUY</div>
      </div>
      <div className="card">
        <div className="label">Historical Transactions</div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Model</th>
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
                <td>{trade.model_id ?? '—'}</td>
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
