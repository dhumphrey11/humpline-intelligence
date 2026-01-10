-- App-wide settings store
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default test_mode=false
INSERT INTO app_settings (key, value)
VALUES ('test_mode', '{"enabled": false}')
ON CONFLICT (key) DO NOTHING;
