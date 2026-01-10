import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query, withTransaction, logAction } from '@humpline/shared';
import { logsRouter } from './routes/logs.js';

const app = express();
app.use(express.json());

const ADMIN_BYPASS = process.env.ADMIN_BYPASS === 'true';
const ADMIN_EMAILS = new Set(['dhumphrey11@gmail.com', 'trevorjames.snow@gmail.com']);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const authClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const TICK_ORCHESTRATOR_URL =
  process.env.TICK_ORCHESTRATOR_URL ?? 'http://localhost:8081';

type AppSettings = {
  test_mode: boolean;
  notify_to?: string[];
};

function extractEmail(header?: string) {
  if (!header) {
    return null;
  }
  const value = header.includes(':') ? header.split(':').pop() : header;
  return value ?? null;
}

async function verifyBearerToken(token?: string) {
  if (!token || !GOOGLE_CLIENT_ID) {
    return null;
  }
  try {
    const ticket = await authClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    return payload?.email ?? null;
  } catch {
    return null;
  }
}

async function getRequestEmail(req: express.Request) {
  const iapHeader = req.headers['x-goog-authenticated-user-email'] as string | undefined;
  const iapEmail = extractEmail(iapHeader);
  if (iapEmail) {
    return iapEmail;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return await verifyBearerToken(token);
  }
  return null;
}

async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const email = await getRequestEmail(req);
  if (!email) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  res.locals.userEmail = email;
  next();
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (ADMIN_BYPASS) {
    next();
    return;
  }
  const email = (res.locals.userEmail as string | undefined) ?? (await getRequestEmail(req));
  if (!email || !ADMIN_EMAILS.has(email)) {
    res.status(403).json({ error: 'admin access required' });
    return;
  }
  res.locals.userEmail = email;
  next();
}

async function getActiveModelId() {
  const result = await query<{ model_id: string }>('SELECT model_id FROM models WHERE is_active = true LIMIT 1');
  return result.rows[0]?.model_id ?? null;
}

async function getSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: any }>(
    'SELECT key, value FROM app_settings WHERE key IN ($1, $2)',
    ['test_mode', 'notify_to']
  );
  const map = new Map(rows.rows.map((r) => [r.key, r.value]));
  const enabled = map.get('test_mode')?.enabled ?? false;
  const notify_to = map.get('notify_to')?.emails ?? null;
  return { test_mode: enabled, notify_to };
}

async function setTestMode(enabled: boolean) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('test_mode', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [{ enabled }]
  );
}

async function setNotifyRecipients(emails: string) {
  const list = emails
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('notify_to', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [{ emails: list }]
  );
}

app.use('/api', requireUser);

app.get('/api/models', async (_req, res) => {
  const models = await query('SELECT * FROM models ORDER BY created_at DESC');
  res.status(200).json(models.rows);
});

app.get('/api/models/:model_id', async (req, res) => {
  const modelId = req.params.model_id;
  const model = await query('SELECT * FROM models WHERE model_id = $1', [modelId]);
  if (model.rows.length === 0) {
    res.status(404).json({ error: 'model not found' });
    return;
  }
  const snapshots = await query(
    'SELECT * FROM performance_snapshots WHERE model_id = $1 ORDER BY as_of DESC',
    [modelId]
  );
  res.status(200).json({ ...model.rows[0], performance_snapshots: snapshots.rows });
});

app.get('/api/portfolio/current', async (_req, res) => {
  const modelId = await getActiveModelId();
  if (!modelId) {
    res.status(404).json({ error: 'no active model' });
    return;
  }
  const portfolioId = `paper_${modelId}`;
  const state = await query(
    `SELECT * FROM portfolio_states WHERE portfolio_id = $1 ORDER BY tick_id DESC LIMIT 1`,
    [portfolioId]
  );
  const latest = state.rows[0];
  if (!latest) {
    res.status(200).json({ portfolio_id: portfolioId, model_id: modelId, state: null, signals: [], llm: null });
    return;
  }
  const signals = await query(
    'SELECT * FROM signals WHERE model_id = $1 AND tick_id = $2 ORDER BY symbol',
    [modelId, latest.tick_id]
  );
  const llm = await query(
    'SELECT * FROM llm_explanations WHERE model_id = $1 AND tick_id = $2 LIMIT 1',
    [modelId, latest.tick_id]
  );
  res.status(200).json({ portfolio_id: portfolioId, model_id: modelId, state: latest, signals: signals.rows, llm: llm.rows[0] ?? null });
});

app.get('/api/portfolio/performance', async (req, res) => {
  const modelId = await getActiveModelId();
  if (!modelId) {
    res.status(404).json({ error: 'no active model' });
    return;
  }
  const range = (req.query.range as string | undefined) ?? '30d';
  const window = range === '90d' ? '90D' : '30D';
  const portfolioId = `paper_${modelId}`;
  const snapshot = await query(
    'SELECT * FROM performance_snapshots WHERE model_id = $1 AND portfolio_id = $2 AND "window" = $3 ORDER BY as_of DESC LIMIT 1',
    [modelId, portfolioId, window]
  );
  res.status(200).json(snapshot.rows[0] ?? null);
});

app.get('/api/portfolio/transactions', async (req, res) => {
  const modelId = await getActiveModelId();
  if (!modelId) {
    res.status(404).json({ error: 'no active model' });
    return;
  }
  const portfolioId = `paper_${modelId}`;
  const limit = Number(req.query.limit ?? 50);
  const trades = await query(
    'SELECT * FROM trades WHERE portfolio_id = $1 ORDER BY ts DESC LIMIT $2',
    [portfolioId, limit]
  );
  res.status(200).json(trades.rows);
});

app.get('/api/portfolio/states', async (req, res) => {
  const modelId = await getActiveModelId();
  if (!modelId) {
    res.status(404).json({ error: 'no active model' });
    return;
  }
  const portfolioId = `paper_${modelId}`;
  const limit = Number(req.query.limit ?? 5);
  const rows = await query(
    `SELECT ps.tick_id,
            ps.weights_target,
            ps.weights_current,
            ps.holdings,
            ps.total_equity_usd,
            ps.cash_usd,
            (
              SELECT content
              FROM llm_explanations le
              WHERE le.model_id = $2
                AND le.tick_id = ps.tick_id
              ORDER BY le.created_at DESC
              LIMIT 1
            ) AS llm_content
     FROM portfolio_states ps
     WHERE ps.portfolio_id = $1
     ORDER BY ps.tick_id DESC
     LIMIT $3`,
    [portfolioId, modelId, limit]
  );
  res.status(200).json(rows.rows);
});

app.get('/api/trades', async (req, res) => {
  const { model_id, symbol, side, from, to, limit } = req.query as Record<string, string>;
  const clauses: string[] = [];
  const params: Array<string | number | Date> = [];
  if (model_id) {
    clauses.push(`model_id = $${params.length + 1}`);
    params.push(model_id);
  }
  if (symbol) {
    clauses.push(`symbol = $${params.length + 1}`);
    params.push(symbol);
  }
  if (side) {
    clauses.push(`side = $${params.length + 1}`);
    params.push(side);
  }
  if (from) {
    clauses.push(`ts >= $${params.length + 1}`);
    params.push(new Date(from));
  }
  if (to) {
    clauses.push(`ts <= $${params.length + 1}`);
    params.push(new Date(to));
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM trades ${where} ORDER BY ts DESC LIMIT $${params.length + 1}`;
  params.push(Number(limit ?? 100));
  const trades = await query(sql, params);
  res.status(200).json(trades.rows);
});

app.get('/api/monitor/leaderboard', async (req, res) => {
  const range = (req.query.range as string | undefined) ?? '90d';
  const window = range === '30d' ? '30D' : '90D';
  const snapshots = await query(
    `SELECT * FROM performance_snapshots
     WHERE "window" = $1
     ORDER BY (metrics->>'return_pct')::numeric DESC`,
    [window]
  );
  res.status(200).json(snapshots.rows);
});

app.get('/api/monitor/equity_curves', async (req, res) => {
  const modelIds = (req.query.model_ids as string | undefined)?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  const range = Number(req.query.range ?? 180);
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  if (modelIds.length === 0) {
    res.status(400).json({ error: 'model_ids required' });
    return;
  }
  const rows = await query(
    `SELECT model_id, portfolio_id, tick_id, total_equity_usd
     FROM portfolio_states
     WHERE model_id = ANY($1) AND tick_id >= $2
     ORDER BY tick_id ASC`,
    [modelIds, since]
  );
  res.status(200).json(rows.rows);
});

app.get('/api/monitor/alerts', async (_req, res) => {
  const ticks = await query(
    `SELECT * FROM ticks WHERE status = 'FAILED' ORDER BY tick_id DESC LIMIT 20`
  );
  res.status(200).json({ alerts: ticks.rows.map((row) => ({
    type: 'tick_failure',
    tick_id: row.tick_id,
    notes: row.notes
  })) });
});

app.post('/api/admin/models/:model_id/set_active', requireAdmin, async (req, res) => {
  const modelId = req.params.model_id;
  const actor = res.locals.userEmail as string | undefined;
  await withTransaction(async (client) => {
    await client.query('UPDATE models SET is_active = false');
    await client.query('UPDATE models SET is_active = true WHERE model_id = $1', [modelId]);
  });
  await logAction({
    actor,
    source: 'api-service',
    action: 'set_active_model',
    status: 'SUCCESS',
    detail: { model_id: modelId }
  });
  res.status(200).json({ status: 'ok', model_id: modelId, is_active: true });
});

app.post('/api/admin/models/:model_id/set_contender', requireAdmin, async (req, res) => {
  const modelId = req.params.model_id;
  const desired = req.body?.is_contender as boolean | undefined;
  const actor = res.locals.userEmail as string | undefined;
  if (typeof desired === 'boolean') {
    await query('UPDATE models SET is_contender = $1 WHERE model_id = $2', [desired, modelId]);
    await logAction({
      actor,
      source: 'api-service',
      action: 'set_contender_model',
      status: 'SUCCESS',
      detail: { model_id: modelId, is_contender: desired }
    });
    res.status(200).json({ status: 'ok', model_id: modelId, is_contender: desired });
    return;
  }
  const current = await query<{ is_contender: boolean }>('SELECT is_contender FROM models WHERE model_id = $1', [modelId]);
  const next = !(current.rows[0]?.is_contender ?? false);
  await query('UPDATE models SET is_contender = $1 WHERE model_id = $2', [next, modelId]);
  await logAction({
    actor,
    source: 'api-service',
    action: 'toggle_contender_model',
    status: 'SUCCESS',
    detail: { model_id: modelId, is_contender: next }
  });
  res.status(200).json({ status: 'ok', model_id: modelId, is_contender: next });
});

app.post('/api/admin/tick/run', requireAdmin, async (req, res) => {
  const tickId = req.body?.tick_id as string | undefined;
  const target = `${TICK_ORCHESTRATOR_URL}/tick/run${tickId ? `?tick_id=${encodeURIComponent(tickId)}` : ''}`;
  const actor = res.locals.userEmail as string | undefined;
  try {
    const response = await fetch(target, { method: 'POST' });
    const body = await response.json().catch(() => null);
    await logAction({
      actor,
      source: 'api-service',
      action: 'tick_run',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      detail: { tick_id: tickId ?? 'auto', response: body }
    });
    res.status(response.status).json(body ?? { status: response.status });
  } catch (error: any) {
    await logAction({
      actor,
      source: 'api-service',
      action: 'tick_run',
      status: 'FAILED',
      detail: { tick_id: tickId ?? 'auto', error: error?.message ?? 'tick run failed' }
    });
    res.status(500).json({ error: error?.message ?? 'tick run failed' });
  }
});

app.get('/api/admin/system/health', requireAdmin, async (_req, res) => {
  const ticks = await query('SELECT * FROM ticks ORDER BY tick_id DESC LIMIT 20');
  const ingestion = await query('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 20');
  const lastCandles = await query(
    `SELECT symbol, MAX(ts) as last_ts FROM candles WHERE timeframe = '1h' AND source = 'coinbase' GROUP BY symbol`
  );
  const settings = await getSettings();
  res.status(200).json({
    ticks: ticks.rows,
    ingestion_runs: ingestion.rows,
    last_candles: lastCandles.rows,
    settings
  });
});

app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  const settings = await getSettings();
  res.status(200).json(settings);
});

app.post('/api/admin/settings/test_mode', requireAdmin, async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  await setTestMode(enabled);
  await logAction({
    actor: res.locals.userEmail as string | undefined,
    source: 'api-service',
    action: 'set_test_mode',
    status: 'SUCCESS',
    detail: { enabled }
  });
  res.status(200).json({ test_mode: enabled });
});

app.post('/api/admin/settings/notify_to', requireAdmin, async (req, res) => {
  const incoming = req.body?.emails as string | string[] | undefined;
  const emails =
    Array.isArray(incoming) ? incoming.join(',') : (incoming ?? '');
  await setNotifyRecipients(emails);
  await logAction({
    actor: res.locals.userEmail as string | undefined,
    source: 'api-service',
    action: 'set_notify_to',
    status: 'SUCCESS',
    detail: { emails }
  });
  res.status(200).json({ notify_to: emails });
});

app.get('/api/admin/data/overview', requireAdmin, async (_req, res) => {
  const recentCandles = await query(
    `SELECT symbol, ts, open, high, low, close, volume
     FROM candles
     WHERE timeframe = '1h' AND source = 'coinbase'
     ORDER BY ts DESC
     LIMIT 50`
  );
  const recentSignals = await query(
    `SELECT model_id, tick_id, symbol, asset_score, signal, confidence
     FROM signals
     ORDER BY tick_id DESC, symbol
     LIMIT 50`
  );
  const recentTrades = await query(
    `SELECT trade_id, portfolio_id, model_id, ts, symbol, side, qty, notional_usd
     FROM trades
     ORDER BY ts DESC
     LIMIT 50`
  );
  const recentPortfolios = await query(
    `SELECT portfolio_id, model_id, tick_id, total_equity_usd, cash_usd, weights_current, weights_target
     FROM portfolio_states
     ORDER BY tick_id DESC
     LIMIT 20`
  );
  res.status(200).json({
    recent_candles: recentCandles.rows,
    recent_signals: recentSignals.rows,
    recent_trades: recentTrades.rows,
    recent_portfolios: recentPortfolios.rows
  });
});

app.use('/api/admin/logs', requireAdmin, logsRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/me', (req, res) => {
  const email = (res.locals.userEmail as string | undefined) ?? null;
  const role = email && ADMIN_EMAILS.has(email) ? 'admin' : 'guest';
  res.status(200).json({ email, role });
});

const port = Number(process.env.PORT ?? 8085);
app.listen(port, () => {
  console.log(`api-service listening on ${port}`);
});
