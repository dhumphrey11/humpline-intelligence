import express from 'express';
import { query } from '@humpline/shared';
import { alignTickBoundary } from '@humpline/shared';

const app = express();
app.use(express.json());

const MODEL_RUNNER_URL = process.env.MODEL_RUNNER_URL ?? 'http://localhost:8082';
const METRICS_SERVICE_URL = process.env.METRICS_SERVICE_URL ?? 'http://localhost:8083';
const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL ?? 'http://localhost:8084';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8086';

async function ensureTickRow(tickId: Date) {
  await query(
    `INSERT INTO ticks (tick_id, status, started_at)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [tickId, 'PENDING', new Date()]
  );
}

async function setTickStatus(tickId: Date, status: string, notes?: string) {
  await query(
    `UPDATE ticks SET status = $1, notes = $2, completed_at = $3 WHERE tick_id = $4`,
    [status, notes ?? null, status === 'COMPLETE' || status === 'FAILED' ? new Date() : null, tickId]
  );
}

async function getActiveModelId() {
  const result = await query<{ model_id: string }>(
    'SELECT model_id FROM models WHERE is_active = true LIMIT 1'
  );
  return result.rows[0]?.model_id ?? null;
}

async function checkDataCompleteness(tickId: Date) {
  const symbols = ['BTC', 'ETH', 'ADA'];
  const missing: string[] = [];
  for (const symbol of symbols) {
    const result = await query<{ max_ts: Date }>(
      'SELECT MAX(ts) as max_ts FROM candles WHERE symbol = $1 AND timeframe = $2 AND source = $3',
      [symbol, '1h', 'coinbase']
    );
    const maxTs = result.rows[0]?.max_ts;
    if (!maxTs || new Date(maxTs).getTime() < tickId.getTime()) {
      missing.push(symbol);
    }
  }
  return missing;
}

app.post('/tick/run', async (req, res) => {
  const tickIdParam = req.query.tick_id as string | undefined;
  const tickId = tickIdParam ? new Date(tickIdParam) : alignTickBoundary(new Date());

  await ensureTickRow(tickId);
  const existing = await query<{ status: string }>('SELECT status FROM ticks WHERE tick_id = $1', [tickId]);
  if (existing.rows[0]?.status === 'COMPLETE') {
    res.status(200).json({ tick_id: tickId.toISOString(), status: 'COMPLETE', message: 'no-op' });
    return;
  }

  const missing = await checkDataCompleteness(tickId);
  if (missing.length > 0) {
    await setTickStatus(tickId, 'FAILED', `Missing candles for: ${missing.join(', ')}`);
    console.error('tick run blocked due to missing candles', { tick: tickId.toISOString(), missing });
    res.status(400).json({
      tick_id: tickId.toISOString(),
      status: 'FAILED',
      error: 'missing_candles',
      missing
    });
    return;
  }

  await query(
    'UPDATE ticks SET status = $1, started_at = $2 WHERE tick_id = $3',
    ['RUNNING', new Date(), tickId]
  );

  try {
    const models = await query<{ model_id: string }>(
      'SELECT model_id FROM models WHERE is_active = true OR is_contender = true ORDER BY model_id'
    );
    for (const model of models.rows) {
      const response = await fetch(`${MODEL_RUNNER_URL}/models/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model_id: model.model_id,
          tick_id: tickId.toISOString(),
          portfolio_id: `paper_${model.model_id}`
        })
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Model run failed for ${model.model_id}: ${response.status} ${body}`);
      }
    }

    await fetch(`${METRICS_SERVICE_URL}/metrics/tick?tick_id=${encodeURIComponent(tickId.toISOString())}`, {
      method: 'POST'
    });

    const activeModelId = await getActiveModelId();
    if (activeModelId) {
      await fetch(`${LLM_SERVICE_URL}/llm/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model_id: activeModelId, tick_id: tickId.toISOString() })
      });
    }

    if (activeModelId) {
      try {
        await fetch(`${NOTIFICATION_SERVICE_URL}/notify/allocations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model_id: activeModelId, tick_id: tickId.toISOString() })
        });
      } catch (error) {
        console.error('notification-service failed', error);
      }
    }

    await setTickStatus(tickId, 'COMPLETE');
    res.status(200).json({ tick_id: tickId.toISOString(), status: 'COMPLETE' });
  } catch (error: any) {
    await setTickStatus(tickId, 'FAILED', error?.message ?? 'unknown error');
    res.status(500).json({ tick_id: tickId.toISOString(), status: 'FAILED', error: error?.message ?? 'unknown error' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8081);
app.listen(port, () => {
  console.log(`tick-orchestrator listening on ${port}`);
});
