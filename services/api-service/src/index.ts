import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query, withTransaction } from '@humpline/shared';

const app = express();
app.use(express.json());

const ADMIN_BYPASS = process.env.ADMIN_BYPASS === 'true';
const ADMIN_EMAILS = new Set(['dhumphrey11@gmail.com', 'trevorjames.snow@gmail.com']);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const authClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
  next();
}

async function getActiveModelId() {
  const result = await query<{ model_id: string }>('SELECT model_id FROM models WHERE is_active = true LIMIT 1');
  return result.rows[0]?.model_id ?? null;
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
  await withTransaction(async (client) => {
    await client.query('UPDATE models SET is_active = false');
    await client.query('UPDATE models SET is_active = true WHERE model_id = $1', [modelId]);
  });
  res.status(200).json({ status: 'ok', model_id: modelId, is_active: true });
});

app.post('/api/admin/models/:model_id/set_contender', requireAdmin, async (req, res) => {
  const modelId = req.params.model_id;
  const desired = req.body?.is_contender as boolean | undefined;
  if (typeof desired === 'boolean') {
    await query('UPDATE models SET is_contender = $1 WHERE model_id = $2', [desired, modelId]);
    res.status(200).json({ status: 'ok', model_id: modelId, is_contender: desired });
    return;
  }
  const current = await query<{ is_contender: boolean }>('SELECT is_contender FROM models WHERE model_id = $1', [modelId]);
  const next = !(current.rows[0]?.is_contender ?? false);
  await query('UPDATE models SET is_contender = $1 WHERE model_id = $2', [next, modelId]);
  res.status(200).json({ status: 'ok', model_id: modelId, is_contender: next });
});

app.get('/api/admin/system/health', requireAdmin, async (_req, res) => {
  const ticks = await query('SELECT * FROM ticks ORDER BY tick_id DESC LIMIT 20');
  const ingestion = await query('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 20');
  const lastCandles = await query(
    `SELECT symbol, MAX(ts) as last_ts FROM candles WHERE timeframe = '1h' AND source = 'coinbase' GROUP BY symbol`
  );
  res.status(200).json({
    ticks: ticks.rows,
    ingestion_runs: ingestion.rows,
    last_candles: lastCandles.rows
  });
});

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
