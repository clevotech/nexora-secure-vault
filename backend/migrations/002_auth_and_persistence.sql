-- Nexora persistence hardening.
-- Authentication remains external (OIDC/JWT); only stable subject IDs are stored.
CREATE INDEX IF NOT EXISTS nexora_jobs_status_idx ON nexora_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS nexora_jobs_user_status_idx ON nexora_jobs(user_id,status,created_at);
CREATE INDEX IF NOT EXISTS nexora_memory_updated_idx ON nexora_memory(user_id,updated_at DESC);
