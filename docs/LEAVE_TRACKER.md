# Nexora Leave Tracker and audit events

This branch adds the Leave Tracker workspace UI and server-side API to Nexora's existing GitHub/Render application.

## API

All requests use POST /leave with the same Bearer-token authentication as the rest of the API. The signed-in user's token subject is the employee identity.

- profile.save — HR/admin creates or updates an employee profile.
- profile.list — HR/admin lists employee profiles.
- request.create — submit a leave request with category, startDate, endDate and optional reason.
- request.list — employees see their own requests; HR/admin sees the organization list.
- request.decide — assigned supervisor or HR/admin approves/rejects a pending request.
- certificate.get — employee or HR/admin retrieves an approved/completed leave certificate. The UI can download a standalone HTML certificate or open a print dialog to print or save as PDF. Pending/rejected requests are refused and generation is audit logged.
- request.cancel — employee cancels their own pending/approved request.
- resumption.confirm — employee records actual return to work.
- calendar.holiday.save / calendar.holiday.list — HR/admin maintains holiday dates.
- audit.list — admin-only audit event query.

## Persistence and security

Startup applies additive schemas in backend/migrations/003_leave_tracker_audit.sql and backend/migrations/004_leave_holidays.sql. They create employee profiles, leave policies, leave requests, approvals, a notification outbox, reminder idempotency keys, a configurable holiday calendar, and hash-linked audit events. Existing tables are not dropped. Leave days use the employee's configured workweek and recorded holidays. An eligible supervisor or HR/admin approver must exist; the system will not assign the employee as their own approver.

The API uses the verified JWT subject as the actor; clients cannot select another actor for their own leave request. Authenticated API route metadata is also written to the audit log without recording request bodies, prompts, passwords, or generated content. Organization-wide lists and audit queries require HR/admin scopes, and supervisor decisions are checked against the employee's assigned supervisor. Phone numbers must be E.164 formatted. Audit details should never contain passwords, API keys, medical attachment contents, or raw authentication tokens.

## WhatsApp and automation

The sender process is implemented at backend/src/leave-notification-worker.ts and can be started with npm run leave-worker from backend/. Configure DATABASE_URL, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_GRAPH_API_VERSION for the worker; optionally set WHATSAPP_TEMPLATE_LANGUAGE and NEXORA_LEAVE_POLL_MS. Configure WHATSAPP_APP_SECRET and WHATSAPP_WEBHOOK_VERIFY_TOKEN on the API service, then register https://YOUR_API_HOST/webhooks/whatsapp as the Meta callback URL and subscribe to message status updates.

Create and approve the six matching WhatsApp Business templates: leave_request_submitted, leave_request_approved, leave_request_rejected, leave_return_3_days, leave_return_1_day, and leave_return_today. Their body placeholders must match the worker mappings. The worker claims queued records safely across instances and retries transient failures with exponential backoff. A signed delivery-status webhook is implemented at /webhooks/whatsapp. It verifies the x-hub-signature-256 HMAC using WHATSAPP_APP_SECRET and updates sent/delivered/failed states. Verify the callback with WHATSAPP_WEBHOOK_VERIFY_TOKEN and confirm Meta webhook delivery in the live deployment before announcing production readiness.

Return reminders are scheduled for 09:00 in each employee's validated IANA timezone, including daylight-saving offsets. The webhook code is implemented but has not been tested against a live Meta app. Actual WhatsApp delivery requires valid Meta credentials, approved templates, a separately deployed worker process, and a verified callback subscription.

## Deployment notes

Merge only after CI passes. The backend startup migrations run when DATABASE_URL is configured. Keep OIDC authentication enabled in production; do not enable NEXORA_DEV_AUTH on the public service.


## Organization registration and membership

The Organization workspace is available from the main navigation. An authenticated user can register one organization with its name, contact details, address, country, industry, registration number and HTTPS logo URL. The first registrant becomes that organization’s Admin Officer. The API generates an organization code (`NXO-…`) and user codes (`NXU-…`) server-side; the browser cannot select privileged roles during initial registration. Only the Admin Officer can invite additional users, with Employee, Supervisor or HR roles. Invitations use Supabase Auth and require the backend-only `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` environment variables on Render. Never expose the service-role key to the browser. Invited users receive an email invitation and are activated when they sign in with the invited identity. Organization membership and role changes are server-authorized and audited.
