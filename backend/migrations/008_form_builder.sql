CREATE TABLE IF NOT EXISTS nexora_published_forms(
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  form_title TEXT NOT NULL,
  site_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_published_forms_owner_idx ON nexora_published_forms(owner_user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS nexora_form_submissions(
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES nexora_published_forms(id) ON DELETE CASCADE,
  form_title TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS nexora_form_submissions_form_idx ON nexora_form_submissions(form_id,submitted_at DESC);
