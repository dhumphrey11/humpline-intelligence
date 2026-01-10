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
  const signalLine = signals.length
    ? signals
        .map((s) => `${s.symbol}:${s.signal} score=${Number(s.asset_score ?? 0).toFixed(2)} conf=${s.confidence}`)
        .join(' | ')
    : 'none';
  const summaryLines = [
    `Model: ${modelId}`,
    `Tick: ${tickId}`,
    `Target weights: ${JSON.stringify(weights)}`,
    `Current weights: ${JSON.stringify(current)}`,
    `Total equity: ${portfolio?.total_equity_usd ?? 'n/a'}, Cash: ${portfolio?.cash_usd ?? 'n/a'}`,
    `Signals: ${signalLine}`
  ].join('\n');

  const system = `You are a concise trading commentary generator. 
Highlight allocation rationale, trend/momentum cues, and any caution (low confidence, mixed signals).
Output 3-5 bullet lines max. No fluff.`;

  return {
    system,
    user: summaryLines
  };
}

type ModelVersionInput = {
  model_id: string;
  version: string;
  notes?: string;
  factor_config?: any;
  exec_config?: any;
  data_config?: any;
};

function buildModelVersionPrompt(
  input: ModelVersionInput,
  previousSummary: { methodology: string; change_notes: string } | null
) {
  const system = `You are an expert quant strategy reviewer.
Return concise, business-friendly prose: 3-5 sentences for methodology, 1-3 sentences for change from previous.
Avoid code, math notation, and marketing fluff.`;

  const userLines = [
    `Model ID: ${input.model_id}`,
    `Version: ${input.version}`,
    input.notes ? `Notes: ${input.notes}` : null,
    input.factor_config ? `Factors: ${JSON.stringify(input.factor_config)}` : null,
    input.exec_config ? `Execution: ${JSON.stringify(input.exec_config)}` : null,
    input.data_config ? `Data: ${JSON.stringify(input.data_config)}` : null,
    previousSummary
      ? `Previous version summary:\nMethodology: ${previousSummary.methodology}\nChange: ${previousSummary.change_notes}`
      : 'Previous version summary: none available'
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system,
    user: `${userLines}\n\nRespond as JSON with keys: methodology (3-5 sentences) and change_notes (1-3 sentences).`
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

app.post('/llm/model-version', async (req, res) => {
  const { model_id, version, notes, factor_config, exec_config, data_config } = req.body as ModelVersionInput;
  if (!model_id || !version) {
    res.status(400).json({ error: 'model_id and version required' });
    return;
  }

  const testMode = await getTestMode();

  const previous = await query<{
    methodology: string;
    change_notes: string;
  }>(
    `SELECT methodology, change_notes
     FROM model_version_summaries
     WHERE model_id = $1 AND version <> $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [model_id, version]
  );
  const priorSummary = previous.rows[0] ?? null;

  const prompt = buildModelVersionPrompt(
    { model_id, version, notes, factor_config, exec_config, data_config },
    priorSummary
  );

  const id = uuidv4();
  let methodology = 'Model methodology summary placeholder.';
  let changeNotes = priorSummary ? `Incremental change from previous version.` : 'First version recorded.';
  let flags: Record<string, any> = { source: 'placeholder', caution: true };

  if (!testMode && openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        max_tokens: 400,
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as { methodology?: string; change_notes?: string };
        methodology = parsed.methodology ?? methodology;
        changeNotes = parsed.change_notes ?? changeNotes;
      }
      flags = { source: 'openai', model: OPENAI_MODEL, caution: false };
    } catch (error: any) {
      methodology = `LLM summary failed: ${error?.message ?? 'unknown error'}`;
      changeNotes = priorSummary?.change_notes ?? changeNotes;
      flags = { source: 'openai', caution: true, error: true };
    }
  } else if (testMode) {
    methodology = `Test mode: skip LLM call.`;
    changeNotes = priorSummary?.change_notes ?? changeNotes;
    flags = { source: 'test_mode', caution: true, test_mode: true };
  }

  await query(
    `INSERT INTO model_version_summaries (id, model_id, version, methodology, change_notes, flags)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, model_id, version, methodology, changeNotes, flags]
  );

  res.status(200).json({ status: 'ok', id, methodology, change_notes: changeNotes, test_mode: testMode });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 8084);
app.listen(port, () => {
  console.log(`llm-commentary-service listening on ${port}`);
});
