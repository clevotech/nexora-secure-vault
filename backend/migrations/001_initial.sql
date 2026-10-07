CREATE TABLE IF NOT EXISTS nexora_memory(
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nexora_memory_user_idx
  ON nexora_memory(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS nexora_credits(
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta NUMERIC(30,10) NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS nexora_credits_user_idx
  ON nexora_credits(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS nexora_jobs(
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('image','video','transcription','speech')),
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nexora_jobs_user_idx
  ON nexora_jobs(user_id,created_at DESC);
