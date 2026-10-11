-- Company holiday calendar used when calculating leave days and expected return dates.
CREATE TABLE IF NOT EXISTS nexora_leave_holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_leave_holidays_region_date_idx ON nexora_leave_holidays(region, holiday_date);
