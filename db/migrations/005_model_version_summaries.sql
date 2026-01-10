-- Store LLM-authored summaries for each model version.
CREATE TABLE IF NOT EXISTS model_version_summaries (
  id uuid PRIMARY KEY,
  model_id text NOT NULL REFERENCES models(model_id),
  version text NOT NULL,
  methodology text NOT NULL,
  change_notes text NOT NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, version)
);
