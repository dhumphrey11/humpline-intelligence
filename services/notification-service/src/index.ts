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

function formatWeights(weights: Record<string, number>) {
  const entries = Object.entries(weights ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return entries
    .map(([k, v]) => `${k}: ${(Number(v) * 100).toFixed(2)}%`)
    .join(' | ');
}

function formatHoldings(holdings: Record<string, number>) {
  const entries = Object.entries(holdings ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return entries
    .map(([k, v]) => `${k}: ${Number(v).toFixed(6)}`)
    .join(' | ');
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
    holdings: Record<string, number>;
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target, weights_current, total_equity_usd, holdings
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
    holdings: Record<string, number>;
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target, weights_current, total_equity_usd, holdings
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
  const equityNow = latestRow?.total_equity_usd ?? null;
  const equityPrev = previousRow?.total_equity_usd ?? null;
  const equityDelta = equityNow !== null && equityPrev !== null ? equityNow - equityPrev : null;

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

  const holdingsText = latestRow?.holdings ? formatHoldings(latestRow.holdings) : 'n/a';
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
      <h2 style="margin: 0 0 4px 0;">${testMode ? '🧪 TEST ' : ''}Humpline Allocation ${changed ? 'Change' : 'Update'}</h2>
      <p style="margin: 0 0 12px 0; color: #475569;">Model ${modelId} · Tick ${new Date(tickId).toISOString()}</p>

      <div style="margin-bottom: 12px; padding: 12px; border-radius: 10px; background: #e0f2fe;">
        <strong>Allocation changed:</strong> ${changed ? '<span style="color:#0f766e;">YES</span>' : 'NO'}
      </div>

      <div style="margin-bottom: 12px;">
        <strong>Latest target weights</strong><br/>
        <code>${formatWeights(latestWeights) || 'n/a'}</code>
      </div>
      <div style="margin-bottom: 12px;">
        <strong>Previous target weights</strong><br/>
        <code>${previousRow ? formatWeights(previousWeights) : 'n/a'}</code>
      </div>

      <div style="margin-bottom: 12px; padding: 12px; border-radius: 10px; background: #fef9c3;">
        <strong>Portfolio value</strong><br/>
        Current: ${equityNow !== null ? `$${Number(equityNow).toLocaleString()}` : 'n/a'}<br/>
        Prev: ${equityPrev !== null ? `$${Number(equityPrev).toLocaleString()}` : 'n/a'}<br/>
        Change: ${equityDelta !== null ? `$${equityDelta.toFixed(2)}` : 'n/a'}
      </div>

      <div style="margin-bottom: 12px;">
        <strong>Current holdings</strong><br/>
        <code>${holdingsText}</code>
      </div>

      <div style="margin-bottom: 12px;">
        <strong>Recent ingestion runs</strong><br/>
        <pre style="background:#0f172a; color:#e2e8f0; padding:10px; border-radius:8px; overflow:auto;">${ingestionText}</pre>
      </div>

      <div style="margin-bottom: 12px;">
        <strong>Trades this tick</strong><br/>
        <pre style="background:#0f172a; color:#e2e8f0; padding:10px; border-radius:8px; overflow:auto;">${tradesText}</pre>
      </div>

      <p style="color:#475569; margin-top: 16px;">Test mode: ${testMode ? 'ON' : 'OFF'}</p>
    </div>
  `;

  try {
    await sendEmail(subject, text + '\n\n' + html.replace(/<[^>]+>/g, ''), recipients);
    // Try to send HTML if supported
    try {
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
        text,
        html
      });
    } catch {
      // fallback handled above
    }
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
