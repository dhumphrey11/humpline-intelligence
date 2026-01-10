import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { query } from '@humpline/shared';

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

async function getTestMode(): Promise<boolean> {
  const result = await query<{ value: { enabled: boolean } }>(
    'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
    ['test_mode']
  );
  return result.rows[0]?.value?.enabled ?? false;
}

async function fetchContext(modelId: string, tickId: string) {
  const signals = await query<{
    symbol: string;
    signal: string;
    asset_score: number;
    confidence: number;
  }>(
    `SELECT symbol, signal, asset_score, confidence
     FROM signals
     WHERE model_id = $1 AND tick_id = $2
     ORDER BY symbol`,
    [modelId, tickId]
  );

  const state = await query<{
    weights_target: Record<string, number>;
    weights_current: Record<string, number>;
    total_equity_usd: number;
    cash_usd: number;
  }>(
    `SELECT weights_target, weights_current, total_equity_usd, cash_usd
     FROM portfolio_states
     WHERE model_id = $1 AND tick_id = $2
     LIMIT 1`,
    [modelId, tickId]
  );

  return {
    signals: signals.rows,
    portfolio: state.rows[0] ?? null
  };
}

function buildPrompt(modelId: string, tickId: string, ctx: Awaited<ReturnType<typeof fetchContext>>) {
  const { signals, portfolio } = ctx;
  const weights = portfolio?.weights_target ?? {};
  const current = portfolio?.weights_current ?? {};
  const summaryLines = [
    `Model: ${modelId}`,
    `Tick: ${tickId}`,
    `Target weights: ${JSON.stringify(weights)}`,
    `Current weights: ${JSON.stringify(current)}`,
    `Total equity: ${portfolio?.total_equity_usd ?? 'n/a'}, Cash: ${portfolio?.cash_usd ?? 'n/a'}`,
    `Signals: ${signals
      .map((s) => `${s.symbol}:${s.signal} score=${s.asset_score.toFixed(2)} conf=${s.confidence}`)
      .join(' | ')}`
  ].join('\n');

  const system = `You are a concise trading commentary generator. 
Highlight allocation rationale, trend/momentum cues, and any caution (low confidence, mixed signals).
Output 3-5 bullet lines max. No fluff.`;

  return {
    system,
    user: summaryLines
  };
}

app.post('/llm/generate', async (req, res) => {
  const { model_id, tick_id } = req.body as { model_id: string; tick_id: string };
  if (!model_id || !tick_id) {
    res.status(400).json({ error: 'model_id and tick_id required' });
    return;
  }

  const ctx = await fetchContext(model_id, tick_id);
  const hasSignals = ctx.signals.length > 0;
  const prompt = buildPrompt(model_id, tick_id, ctx);
  const id = uuidv4();

  let content = `LLM commentary placeholder for model ${model_id} at ${tick_id}.`;
  let flags: Record<string, any> = { source: 'placeholder', caution: true };

  const testMode = await getTestMode();

  if (!testMode && openai && hasSignals) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: 400,
        temperature: 0.3
      });
      content = completion.choices[0]?.message?.content ?? content;
      flags = { source: 'openai', model: OPENAI_MODEL, caution: false };
    } catch (error: any) {
      content = `LLM commentary failed: ${error?.message ?? 'unknown error'}`;
      flags = { source: 'openai', caution: true, error: true };
    }
  } else if (testMode) {
    content = `Test mode active: LLM call skipped for model ${model_id} at ${tick_id}.`;
    flags = { source: 'openai', model: OPENAI_MODEL, caution: true, test_mode: true };
  }

  await query(
    `INSERT INTO llm_explanations (id, model_id, tick_id, content, flags)
     VALUES ($1, $2, $3, $4, $5)`
    , [id, model_id, new Date(tick_id), content, flags]
  );

  await query(
    `UPDATE signals SET llm_explanation_id = $1
     WHERE model_id = $2 AND tick_id = $3`,
    [id, model_id, new Date(tick_id)]
  );

  res.status(200).json({ status: 'ok', id });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8084);
app.listen(port, () => {
  console.log(`llm-commentary-service listening on ${port}`);
});
