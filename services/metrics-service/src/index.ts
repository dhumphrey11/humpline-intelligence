import express from 'express';
import { query } from '@humpline/shared';
import { std } from '@humpline/shared';

const app = express();
app.use(express.json());

interface PortfolioPoint {
  as_of: Date;
  equity: number;
}

function computeMetrics(points: PortfolioPoint[]) {
  if (points.length === 0) {
    return { equity_start: 0, equity_end: 0, return_pct: 0, max_drawdown: 0, volatility: 0 };
  }
  const equityStart = points[0].equity;
  const equityEnd = points[points.length - 1].equity;
  const returns: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1].equity;
    const curr = points[i].equity;
    returns.push(prev === 0 ? 0 : curr / prev - 1);
  }
  let peak = equityStart;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const dd = peak === 0 ? 0 : (peak - point.equity) / peak;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }
  return {
    equity_start: equityStart,
    equity_end: equityEnd,
    return_pct: equityStart === 0 ? 0 : equityEnd / equityStart - 1,
    max_drawdown: maxDrawdown,
    volatility: std(returns)
  };
}

async function computeSnapshots(asOf: Date, windowLabel: 'ALL' | '30D' | '90D', windowDays?: number) {
  const rows = await query<{ model_id: string; portfolio_id: string; tick_id: Date; total_equity_usd: string }>(
    `SELECT model_id, portfolio_id, tick_id, total_equity_usd
     FROM portfolio_states
     WHERE tick_id <= $1
     ${windowDays ? 'AND tick_id >= $2' : ''}
     ORDER BY model_id, portfolio_id, tick_id ASC`,
    windowDays ? [asOf, new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000)] : [asOf]
  );

  const grouped = new Map<string, PortfolioPoint[]>();
  for (const row of rows.rows) {
    const key = `${row.model_id}:${row.portfolio_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push({ as_of: new Date(row.tick_id), equity: Number(row.total_equity_usd) });
  }

  for (const [key, points] of grouped.entries()) {
    const [model_id, portfolio_id] = key.split(':');
    const metrics = computeMetrics(points);
    await query(
      `INSERT INTO performance_snapshots (model_id, portfolio_id, as_of, "window", metrics)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (model_id, portfolio_id, as_of, "window")
       DO UPDATE SET metrics = EXCLUDED.metrics`,
      [model_id, portfolio_id, asOf, windowLabel, metrics]
    );
  }
}

app.post('/metrics/tick', async (req, res) => {
  const tickIdParam = req.query.tick_id as string | undefined;
  if (!tickIdParam) {
    res.status(400).json({ error: 'tick_id required' });
    return;
  }
  const tickId = new Date(tickIdParam);
  await computeSnapshots(tickId, 'ALL');
  await computeSnapshots(tickId, '30D', 30);
  await computeSnapshots(tickId, '90D', 90);
  res.status(200).json({ status: 'ok', as_of: tickId.toISOString() });
});

app.post('/metrics/daily', async (req, res) => {
  const dateParam = req.query.date as string | undefined;
  if (!dateParam) {
    res.status(400).json({ error: 'date required' });
    return;
  }
  const asOf = new Date(`${dateParam}T00:00:00.000Z`);
  await computeSnapshots(asOf, 'ALL');
  await computeSnapshots(asOf, '30D', 30);
  await computeSnapshots(asOf, '90D', 90);
  res.status(200).json({ status: 'ok', as_of: asOf.toISOString() });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8083);
app.listen(port, () => {
  console.log(`metrics-service listening on ${port}`);
});
