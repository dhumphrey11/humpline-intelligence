'use client';

import { useMemo, useState } from 'react';
import { formatUtc } from '../lib/format';

type Props = {
  candles: any[];
  signals: any[];
  trades: any[];
  portfolios: any[];
};

const TABLES = [
  { key: 'candles', label: 'Candles (1H)' },
  { key: 'signals', label: 'Signals' },
  { key: 'trades', label: 'Trades' },
  { key: 'portfolios', label: 'Portfolio States' }
] as const;

const LIMITS = [20, 50, 100] as const;

export function DataViewer({ candles, signals, trades, portfolios }: Props) {
  const [table, setTable] = useState<(typeof TABLES)[number]['key']>('candles');
  const [limit, setLimit] = useState<number>(20);

  const rows = useMemo(() => {
    const dataMap: Record<string, any[]> = {
      candles,
      signals,
      trades,
      portfolios
    };
    const selected = dataMap[table] ?? [];
    return selected.slice(0, limit);
  }, [candles, signals, trades, portfolios, table, limit]);

  return (
    <div className="card">
      <div className="label">Data Explorer</div>
      <div className="data-controls">
        <label className="input-label">
          Table
          <select className="input select" value={table} onChange={(e) => setTable(e.target.value as any)}>
            {TABLES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="input-label">
          Rows
          <select className="input select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>

      {table === 'candles' && (
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
            {rows.map((row, index) => (
              <tr key={`${row.symbol}-${row.ts}-${index}`}>
                <td>{row.symbol}</td>
                <td>{formatUtc(row.ts)}</td>
                <td>{Number(row.open).toFixed(2)}</td>
                <td>{Number(row.high).toFixed(2)}</td>
                <td>{Number(row.low).toFixed(2)}</td>
                <td>{Number(row.close).toFixed(2)}</td>
                <td>{Number(row.volume).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {table === 'signals' && (
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
            {rows.map((row, index) => (
              <tr key={`${row.model_id}-${row.symbol}-${row.tick_id}-${index}`}>
                <td>{formatUtc(row.tick_id)}</td>
                <td>{row.model_id}</td>
                <td>{row.symbol}</td>
                <td>{row.signal}</td>
                <td>{Number(row.asset_score).toFixed(2)}</td>
                <td>{row.confidence}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {table === 'trades' && (
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
            {rows.map((row, index) => (
              <tr key={`${row.trade_id}-${index}`}>
                <td>{formatUtc(row.ts)}</td>
                <td>{row.symbol}</td>
                <td>{row.side}</td>
                <td>{Number(row.qty).toFixed(4)}</td>
                <td>{Number(row.notional_usd).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {table === 'portfolios' && (
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
            {rows.map((row, index) => (
              <tr key={`${row.portfolio_id}-${row.tick_id}-${index}`}>
                <td>{formatUtc(row.tick_id)}</td>
                <td>{row.portfolio_id}</td>
                <td>${Number(row.total_equity_usd).toLocaleString()}</td>
                <td>${Number(row.cash_usd).toLocaleString()}</td>
                <td>{JSON.stringify(row.weights_current)}</td>
                <td>{JSON.stringify(row.weights_target)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
