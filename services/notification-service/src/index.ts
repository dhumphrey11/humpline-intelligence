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
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target
     FROM portfolio_states
     WHERE model_id = $1 AND tick_id = $2
     ORDER BY tick_id DESC
     LIMIT 1`,
    [modelId, tickId]
  );
  const latestRow = latest.rows[0];
  if (!latestRow) {
    res.status(200).json({ status: 'noop', message: 'no portfolio state for tick' });
    return;
  }

  const previous = await query<{
    weights_target: Record<string, number>;
    tick_id: Date;
  }>(
    `SELECT tick_id, weights_target
     FROM portfolio_states
     WHERE model_id = $1 AND tick_id < $2
     ORDER BY tick_id DESC
     LIMIT 1`,
    [modelId, tickId]
  );
  const previousRow = previous.rows[0];
  if (!previousRow) {
    res.status(200).json({ status: 'noop', message: 'no previous portfolio state' });
    return;
  }

  const latestWeights = normalizeWeights(latestRow.weights_target ?? {});
  const previousWeights = normalizeWeights(previousRow.weights_target ?? {});
  const changed =
    JSON.stringify(latestWeights) !== JSON.stringify(previousWeights);

  if (!changed) {
    res.status(200).json({ status: 'noop', message: 'weights unchanged' });
    return;
  }

  const testMode = await getTestMode();
  const configuredRecipients = await getNotifyRecipients();
  const recipients = testMode ? [TEST_EMAIL] : configuredRecipients;
  const subject = `${testMode ? '[TEST]' : ''} Allocation change (${modelId}) @ ${new Date(tickId).toISOString()}`;
  const text = [
    `Model: ${modelId}`,
    `Tick: ${new Date(tickId).toISOString()}`,
    `Test mode: ${testMode}`,
    '',
    'Previous target weights:',
    JSON.stringify(previousWeights, null, 2),
    '',
    'New target weights:',
    JSON.stringify(latestWeights, null, 2)
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
