import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@humpline/shared';

const app = express();
app.use(express.json());

app.post('/llm/generate', async (req, res) => {
  const { model_id, tick_id } = req.body as { model_id: string; tick_id: string };
  if (!model_id || !tick_id) {
    res.status(400).json({ error: 'model_id and tick_id required' });
    return;
  }
  const id = uuidv4();
  const content = `LLM commentary placeholder for model ${model_id} at ${tick_id}.`;
  const flags = { source: 'placeholder', caution: true };

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
