CREATE TABLE IF NOT EXISTS nexora_publish_audit (
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  publication_type TEXT NOT NULL CHECK (publication_type IN ('form','website-or-app')),
  status TEXT NOT NULL CHECK (status IN ('deployment_queued','published','failed')),
  frontend_url TEXT NOT NULL,
  backend_url TEXT NOT NULL,
  attachments_url TEXT NOT NULL,
  commit_url TEXT,
  audit_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_publish_audit_owner_idx
  ON nexora_publish_audit(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nexora_publish_audit_site_idx
  ON nexora_publish_audit(site_name, created_at DESC);
