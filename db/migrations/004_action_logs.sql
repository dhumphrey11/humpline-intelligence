CREATE TABLE IF NOT EXISTS action_logs (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor text,
  source text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  detail jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS action_logs_created_at_idx ON action_logs (created_at DESC);
