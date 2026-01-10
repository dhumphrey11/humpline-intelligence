import express from 'express';
import nodemailer from 'nodemailer';
import { query } from '@humpline/shared';

const app = express();
app.use(express.json());

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const NOTIFY_TO = process.env.NOTIFY_TO ?? '';
const NOTIFY_FROM = process.env.NOTIFY_FROM ?? SMTP_USER;
const TEST_EMAIL = 'dhumphrey11@gmail.com';

function parseRecipients(value: string) {
  return value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function normalizeWeights(weights: Record<string, number>) {
  return Object.keys(weights)
    .sort()
    .reduce<Record<string, number>>((acc, key) => {
      acc[key] = Number(weights[key].toFixed(6));
      return acc;
    }, {});
}

async function getActiveModelId() {
  const result = await query<{ model_id: string }>(
    'SELECT model_id FROM models WHERE is_active = true LIMIT 1'
  );
  return result.rows[0]?.model_id ?? null;
}

async function getTestMode(): Promise<boolean> {
  const result = await query<{ value: { enabled: boolean } }>(
    'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
    ['test_mode']
  );
  return result.rows[0]?.value?.enabled ?? false;
}

async function getNotifyRecipients(): Promise<string[]> {
  const result = await query<{ value: { emails: string[] } }>(
    'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
    ['notify_to']
  );
  const configured = result.rows[0]?.value?.emails ?? [];
  return configured.length > 0 ? configured : parseRecipients(NOTIFY_TO);
}

async function sendEmail(subject: string, text: string, recipients: string[]) {
  if (!SMTP_USER || !SMTP_PASS || !NOTIFY_TO) {
    throw new Error('SMTP credentials or recipients not configured');
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  await transporter.sendMail({
    from: NOTIFY_FROM,
    to: recipients,
    subject,
    text
  });
}

app.post('/notify/allocations', async (req, res) => {
  const tickId = req.body?.tick_id as string | undefined;
  const requestedModelId = req.body?.model_id as string | undefined;
  if (!tickId) {
    res.status(400).json({ error: 'tick_id required' });
    return;
  }

  const modelId = requestedModelId ?? (await getActiveModelId());
  if (!modelId) {
    res.status(404).json({ error: 'no active model found' });
    return;
  }

  const latest = await query<{
    weights_target: Record<string, number>;
    weights_current: Record<string, number>;
    total_equity_usd: number;
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target, weights_current, total_equity_usd
     FROM portfolio_states
     WHERE model_id = $1 AND tick_id = $2
     ORDER BY tick_id DESC
     LIMIT 1`,
    [modelId, tickId]
  );
  const latestRow = latest.rows[0];

  const previous = await query<{
    weights_target: Record<string, number>;
    weights_current: Record<string, number>;
    total_equity_usd: number;
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target, weights_current, total_equity_usd
     FROM portfolio_states
     WHERE model_id = $1 AND tick_id < $2
     ORDER BY tick_id DESC
     LIMIT 1`,
    [modelId, tickId]
  );
  const previousRow = previous.rows[0];

  const latestWeights = normalizeWeights(latestRow?.weights_target ?? {});
  const previousWeights = normalizeWeights(previousRow?.weights_target ?? {});
  const changed =
    !!previousRow &&
    JSON.stringify(latestWeights) !== JSON.stringify(previousWeights);

  const testMode = await getTestMode();
  const configuredRecipients = await getNotifyRecipients();
  const recipients = testMode ? [TEST_EMAIL] : configuredRecipients;
  const subject = `${testMode ? '[TEST] ' : ''}Allocation ${changed ? 'change' : 'update'} (${modelId}) @ ${new Date(tickId).toISOString()}`;

  const trades = await query<{
    trade_id: string;
    symbol: string;
    side: string;
    qty: number;
    notional_usd: number;
    ts: Date;
  }>(
    `SELECT trade_id, symbol, side, qty, notional_usd, ts
     FROM trades
     WHERE model_id = $1 AND tick_id = $2
     ORDER BY ts DESC`,
    [modelId, tickId]
  );

  const ingestion = await query<{
    started_at: Date;
    status: string;
  }>(
    `SELECT started_at, status
     FROM ingestion_runs
     ORDER BY started_at DESC
     LIMIT 3`
  );

  const tradesText =
    trades.rows.length === 0
      ? 'No trades executed.'
      : trades.rows
          .map(
            (t) =>
              `${t.ts.toISOString()} ${t.side} ${t.symbol} qty=${t.qty} notional=$${Number(
                t.notional_usd
              ).toFixed(2)}`
          )
          .join('\n');

  const ingestionText =
    ingestion.rows.length === 0
      ? 'No ingestion runs recorded.'
      : ingestion.rows
          .map((r) => `${r.started_at.toISOString()} status=${r.status}`)
          .join('\n');

  const text = [
    `Model: ${modelId}`,
    `Tick: ${new Date(tickId).toISOString()}`,
    `Test mode: ${testMode}`,
    '',
    'Latest target weights:',
    JSON.stringify(latestWeights, null, 2),
    '',
    previousRow ? 'Previous target weights:' : 'Previous target weights: (none found)',
    previousRow ? JSON.stringify(previousWeights, null, 2) : 'n/a',
    '',
    `Allocation changed: ${changed ? 'YES' : 'NO'}`,
    '',
    'Recent ingestion runs:',
    ingestionText,
    '',
    'Trades this tick:',
    tradesText
  ].join('\n');

  try {
    await sendEmail(subject, text, recipients);
    res.status(200).json({ status: 'sent', model_id: modelId, tick_id: tickId, test_mode: testMode });
  } catch (error: any) {
    res.status(500).json({ status: 'failed', error: error?.message ?? 'send failed' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8086);
app.listen(port, () => {
  console.log(`notification-service listening on ${port}`);
});
