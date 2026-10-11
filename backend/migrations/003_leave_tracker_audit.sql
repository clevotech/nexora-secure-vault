-- Nexora Leave Tracker, notification outbox, and append-only audit events.
CREATE TABLE IF NOT EXISTS nexora_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  employee_number TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  whatsapp_e164 TEXT,
  department TEXT,
  supervisor_user_id TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','supervisor','hr','admin')),
  workweek_days SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  timezone TEXT NOT NULL DEFAULT 'UTC',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_employees_department_idx ON nexora_employees(department, active);
CREATE INDEX IF NOT EXISTS nexora_employees_supervisor_idx ON nexora_employees(supervisor_user_id);

CREATE TABLE IF NOT EXISTS nexora_leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  annual_days NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (annual_days >= 0),
  carryover_days NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (carryover_days >= 0),
  approval_steps JSONB NOT NULL DEFAULT '["supervisor","hr"]'::jsonb,
  requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, category)
);

CREATE TABLE IF NOT EXISTS nexora_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_user_id TEXT NOT NULL,
  policy_id UUID REFERENCES nexora_leave_policies(id),
  category TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expected_resumption_date DATE NOT NULL,
  actual_resumption_at TIMESTAMPTZ,
  reason TEXT,
  attachment_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','completed','overdue')),
  requested_days NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (requested_days >= 0),
  current_approval_step INTEGER NOT NULL DEFAULT 0,
  resumption_confirmed_by TEXT,
  resumption_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (expected_resumption_date > end_date)
);
CREATE INDEX IF NOT EXISTS nexora_leave_employee_dates_idx ON nexora_leave_requests(employee_user_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS nexora_leave_status_resumption_idx ON nexora_leave_requests(status,expected_resumption_date);

CREATE TABLE IF NOT EXISTS nexora_leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES nexora_leave_requests(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('pending','approved','rejected','delegated')),
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(leave_request_id,step_number)
);
CREATE INDEX IF NOT EXISTS nexora_leave_approver_pending_idx ON nexora_leave_approvals(approver_user_id,decision);

CREATE TABLE IF NOT EXISTS nexora_leave_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID REFERENCES nexora_leave_requests(id) ON DELETE SET NULL,
  recipient_user_id TEXT NOT NULL,
  recipient_phone_e164 TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email','in_app')),
  template_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','delivered','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error_code TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_leave_notifications_due_idx ON nexora_leave_notifications(status,scheduled_at);
CREATE INDEX IF NOT EXISTS nexora_leave_notifications_request_idx ON nexora_leave_notifications(leave_request_id);

CREATE TABLE IF NOT EXISTS nexora_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','denied')),
  correlation_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash TEXT NOT NULL DEFAULT '',
  event_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nexora_audit_actor_time_idx ON nexora_audit_events(actor_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS nexora_audit_resource_idx ON nexora_audit_events(resource_type,resource_id,created_at DESC);

-- Idempotent schedule markers prevent duplicate reminders after retries/restarts.
CREATE TABLE IF NOT EXISTS nexora_leave_reminder_keys (
  idempotency_key TEXT PRIMARY KEY,
  leave_request_id UUID NOT NULL REFERENCES nexora_leave_requests(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
