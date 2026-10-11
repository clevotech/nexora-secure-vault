-- Nexora organization registration and tenant membership.
CREATE TABLE IF NOT EXISTS nexora_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_code TEXT NOT NULL UNIQUE DEFAULT ('NXO-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  country TEXT,
  industry TEXT,
  registration_number TEXT,
  logo_url TEXT,
  owner_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(name)) BETWEEN 2 AND 180),
  CHECK (length(trim(email)) BETWEEN 3 AND 254)
);
CREATE TABLE IF NOT EXISTS nexora_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES nexora_organizations(id) ON DELETE CASCADE,
  user_code TEXT NOT NULL UNIQUE DEFAULT ('NXU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT,
  job_title TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin_officer','hr','supervisor','employee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended')),
  invited_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_org_members_org_idx ON nexora_organization_members(organization_id, created_at);
CREATE INDEX IF NOT EXISTS nexora_org_members_email_idx ON nexora_organization_members(organization_id, lower(email));
