# Nexora Leave Tracker and audit events

This branch adds the first server-side Leave Tracker foundation to Nexora's existing GitHub/Render application.

## API

All requests use `POST /leave` with the same Bearer-token authentication as the rest of the API. The signed-in user's token subject is the employee identity.

- `{"action":"profile.save", ...}` — HR/admin creates or updates an employee profile.
- `{"action":"profile.list"}` — HR/admin lists employee profiles.
- `{"action":"request.create","category":"annual","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","reason":"..."}` — submit a leave request.
- `{"action":"request.list"}` — employees see their own requests; HR/admin sees the organization list.
- `{"action":"request.decide","id":"...","decision":"approved"|"rejected","comment":"..."}` — assigned supervisor or HR/admin decision.
- `{"action":"request.cancel","id":"..."}` — employee cancels their own pending/approved request.
- `{"action":"resumption.confirm","id":"...","note":"..."}` — employee records actual return.
- `{"action":"audit.list","limit":50}` — admin-only audit event query.

## Persistence and security

Startup applies the additive schema in `backend/migrations/003_leave_tracker_audit.sql`. It creates employee profiles, leave policies, leave requests, approvals, a notification outbox, reminder idempotency keys, and a hash-linked audit event table. Existing tables are not dropped.

The API uses the verified JWT subject as the actor; clients cannot select another actor for their own leave request. Organization-wide lists and audit queries require HR/admin scopes, and supervisor decisions are checked against the employee's assigned supervisor. Phone numbers must be E.164 formatted. Audit event details should never contain passwords, API keys, medical attachment contents, or raw authentication tokens.

## WhatsApp and automation status

Approval and return reminder notification records are queued in PostgreSQL. This branch does **not** claim that WhatsApp messages are delivered: a separate sender worker, Meta WhatsApp Business credentials, approved message templates, webhook signature verification, retry/backoff and delivery-status handling must be configured before live sending is enabled. Return reminders are scheduled against the expected resumption date; the first version uses 09:00 UTC, so production should be extended to schedule in the employee's configured timezone and apply organization holiday calendars.

## Deployment notes

Merge only after typechecking and tests. The backend startup migration runs only when `DATABASE_URL` is configured. Keep OIDC authentication enabled in production; do not enable `NEXORA_DEV_AUTH` on the public service.
