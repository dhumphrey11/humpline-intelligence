import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction, logAction } from '@humpline/shared';

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

async function fetchCoinbaseCandlesWindow(symbol: string, start: Date, end: Date) {
  const product = SYMBOLS[symbol];
  const url = `${COINBASE_API_BASE}/products/${product}/candles?granularity=3600&start=${start.toISOString()}&end=${end.toISOString()}`;
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

async function fetchCoinbaseCandlesRange(symbol: string, start: Date, end: Date) {
  const oneHourMs = 60 * 60 * 1000;
  const maxWindow = 300 * oneHourMs;
  const all: Array<{ ts: Date; open: number; high: number; low: number; close: number; volume: number }> = [];
  let cursor = new Date(start.getTime());
  while (cursor.getTime() < end.getTime()) {
    const windowEnd = new Date(Math.min(end.getTime(), cursor.getTime() + maxWindow));
    const windowCandles = await fetchCoinbaseCandlesWindow(symbol, cursor, windowEnd);
    all.push(...windowCandles);
    cursor = windowEnd;
  }
  const deduped = new Map<number, typeof all[number]>();
  for (const candle of all) {
    deduped.set(candle.ts.getTime(), candle);
  }
  return Array.from(deduped.values()).sort((a, b) => a.ts.getTime() - b.ts.getTime());
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
    await logAction({
      source: 'ingestion-service',
      action: 'ingest_hourly',
      status: 'SUCCESS',
      detail: { run_id: runId, details }
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
    await logAction({
      source: 'ingestion-service',
      action: 'ingest_hourly',
      status: 'FAILED',
      detail: { run_id: runId, error: error?.message ?? 'unknown error', details }
    });
    res.status(500).json({ run_id: runId, status: 'FAILED', error: error?.message ?? 'unknown error' });
  }
});

app.post('/ingest/backfill', async (req: Request, res: Response) => {
  const runId = uuidv4();
  const startedAt = new Date();
  const details: { symbols: Record<string, unknown>; errors: string[] } = {
    symbols: {},
    errors: []
  };

  const endInput = req.body?.end ? new Date(req.body.end) : new Date();
  const startInput = req.body?.start
    ? new Date(req.body.start)
    : new Date(endInput.getTime() - 300 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startInput.getTime()) || Number.isNaN(endInput.getTime())) {
    res.status(400).json({ error: 'Invalid start or end date' });
    return;
  }

  try {
    for (const symbol of Object.keys(SYMBOLS)) {
      const candles = await fetchCoinbaseCandlesRange(symbol, startInput, endInput);
      let inserted = 0;
      for (const batch of chunk(candles, 500)) {
        const result = await query(
          `INSERT INTO candles (symbol, timeframe, ts, open, high, low, close, volume, source)
           VALUES ${batch.map((_c, idx) => `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`).join(', ')}
           ON CONFLICT DO NOTHING`,
          batch.flatMap((candle) => [
            symbol,
            '1h',
            candle.ts,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            'coinbase'
          ])
        );
        inserted += result.rowCount ?? 0;
      }
      const lastTs = candles[candles.length - 1]?.ts ?? null;
      (details.symbols as Record<string, unknown>)[symbol] = {
        fetched: candles.length,
        inserted,
        last_ts: lastTs ? lastTs.toISOString() : null
      };
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO ingestion_runs (run_id, service, started_at, completed_at, status, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, 'ingestion-service', startedAt, new Date(), 'SUCCESS', details]
      );
    });

    res.status(200).json({ run_id: runId, status: 'SUCCESS', details });
  } catch (error: any) {
    details.errors.push(error?.message ?? 'unknown error');
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO ingestion_runs (run_id, service, started_at, completed_at, status, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, 'ingestion-service', startedAt, new Date(), 'FAILED', details]
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
