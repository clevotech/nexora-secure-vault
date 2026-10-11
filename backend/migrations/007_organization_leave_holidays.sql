-- Tenant-specific holiday calendars; preserve legacy global holiday rows as shared defaults.
CREATE TABLE IF NOT EXISTS nexora_organization_leave_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES nexora_organizations(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, holiday_date)
);
CREATE INDEX IF NOT EXISTS nexora_org_leave_holidays_date_idx
  ON nexora_organization_leave_holidays (organization_id, holiday_date);
