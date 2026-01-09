import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '@humpline/shared';

const app = express();
app.use(express.json());

const COINBASE_API_BASE = process.env.COINBASE_API_BASE ?? 'https://api.exchange.coinbase.com';
const SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  ADA: 'ADA-USD'
};

async function fetchCoinbaseCandles(symbol: string) {
  const product = SYMBOLS[symbol];
  const url = `${COINBASE_API_BASE}/products/${product}/candles?granularity=3600`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coinbase fetch failed for ${symbol}: ${response.status}`);
  }
  const data = (await response.json()) as Array<[number, number, number, number, number, number]>;
  return data
    .map((row) => ({
      ts: new Date(row[0] * 1000),
      low: row[1],
      high: row[2],
      open: row[3],
      close: row[4],
      volume: row[5]
    }))
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

async function insertCandles(client: any, symbol: string, candles: Array<{ ts: Date; open: number; high: number; low: number; close: number; volume: number }>) {
  if (candles.length === 0) {
    return 0;
  }
  const values: string[] = [];
  const params: Array<string | number | Date> = [];
  let idx = 1;
  for (const candle of candles) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    params.push(
      symbol,
      '1h',
      candle.ts,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      'coinbase'
    );
  }
  const sql = `
    INSERT INTO candles (symbol, timeframe, ts, open, high, low, close, volume, source)
    VALUES ${values.join(', ')}
    ON CONFLICT DO NOTHING
  `;
  const result = await client.query(sql, params);
  return result.rowCount ?? 0;
}

app.post('/ingest/hourly', async (_req: Request, res: Response) => {
  const runId = uuidv4();
  const startedAt = new Date();
  const details: { symbols: Record<string, unknown>; errors: string[] } = {
    symbols: {},
    errors: []
  };

  try {
    await withTransaction(async (client) => {
      for (const symbol of Object.keys(SYMBOLS)) {
        const candles = await fetchCoinbaseCandles(symbol);
        const inserted = await insertCandles(client, symbol, candles);
        const lastTs = candles[candles.length - 1]?.ts ?? null;
        (details.symbols as Record<string, unknown>)[symbol] = {
          fetched: candles.length,
          inserted,
          last_ts: lastTs ? lastTs.toISOString() : null
        };
      }

      await client.query(
        `INSERT INTO ingestion_runs (run_id, service, started_at, completed_at, status, details)
         VALUES ($1, $2, $3, $4, $5, $6)`
        , [runId, 'ingestion-service', startedAt, new Date(), 'SUCCESS', details]
      );
    });

    res.status(200).json({ run_id: runId, status: 'SUCCESS', details });
  } catch (error: any) {
    details.errors.push(error?.message ?? 'unknown error');
    await withTransaction(async (client) => {
      await client.query(
      `INSERT INTO ingestion_runs (run_id, service, started_at, completed_at, status, details)
       VALUES ($1, $2, $3, $4, $5, $6)`
      , [runId, 'ingestion-service', startedAt, new Date(), 'FAILED', details]
      );
    });
    res.status(500).json({ run_id: runId, status: 'FAILED', error: error?.message ?? 'unknown error' });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`ingestion-service listening on ${port}`);
});
