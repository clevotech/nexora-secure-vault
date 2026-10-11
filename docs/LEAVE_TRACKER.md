# Nexora Leave Tracker and audit events

This branch adds the Leave Tracker workspace UI and server-side API to Nexora's existing GitHub/Render application.

## API

All requests use POST /leave with the same Bearer-token authentication as the rest of the API. The signed-in user's token subject is the employee identity.

- profile.save — HR/admin creates or updates an employee profile.
- profile.list — HR/admin lists employee profiles.
- request.create — submit a leave request with category, startDate, endDate and optional reason.
- request.list — employees see their own requests; HR/admin sees the organization list.
- request.decide — assigned supervisor or HR/admin approves/rejects a pending request.
- request.cancel — employee cancels their own pending/approved request.
- resumption.confirm — employee records actual return to work.
- calendar.holiday.save / calendar.holiday.list — HR/admin maintains holiday dates.
- audit.list — admin-only audit event query.

## Persistence and security

Startup applies additive schemas in backend/migrations/003_leave_tracker_audit.sql and backend/migrations/004_leave_holidays.sql. They create employee profiles, leave policies, leave requests, approvals, a notification outbox, reminder idempotency keys, a configurable holiday calendar, and hash-linked audit events. Existing tables are not dropped. Leave days use the employee's configured workweek and recorded holidays. An eligible supervisor or HR/admin approver must exist; the system will not assign the employee as their own approver.

The API uses the verified JWT subject as the actor; clients cannot select another actor for their own leave request. Authenticated API route metadata is also written to the audit log without recording request bodies, prompts, passwords, or generated content. Organization-wide lists and audit queries require HR/admin scopes, and supervisor decisions are checked against the employee's assigned supervisor. Phone numbers must be E.164 formatted. Audit details should never contain passwords, API keys, medical attachment contents, or raw authentication tokens.

## WhatsApp and automation

The sender process is implemented at backend/src/leave-notification-worker.ts and can be started with npm run leave-worker from backend/. Configure DATABASE_URL, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_GRAPH_API_VERSION; optionally set WHATSAPP_TEMPLATE_LANGUAGE and NEXORA_LEAVE_POLL_MS.

Create and approve the six matching WhatsApp Business templates: leave_request_submitted, leave_request_approved, leave_request_rejected, leave_return_3_days, leave_return_1_day, and leave_return_today. Their body placeholders must match the worker mappings. The worker claims queued records safely across instances and retries transient failures with exponential backoff. Delivery-status webhook/signature verification is not implemented yet. Do not announce successful delivery until that provider webhook integration is complete.

Return reminders are scheduled for 09:00 in each employee's validated IANA timezone, including daylight-saving offsets. Delivery-status webhook handling remains a production task. Actual WhatsApp delivery requires valid Meta credentials, approved templates, and a separately deployed worker process.

## Deployment notes

Merge only after CI passes. The backend startup migrations run when DATABASE_URL is configured. Keep OIDC authentication enabled in production; do not enable NEXORA_DEV_AUTH on the public service.
