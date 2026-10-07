CREATE TABLE IF NOT EXISTS nexora_memory(
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nexora_memory_user_idx
  ON nexora_memory(user_id,created_at DESC);
