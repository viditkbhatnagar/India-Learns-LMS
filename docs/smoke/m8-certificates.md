# M8 — Certificates + Notifications + Analytics (manual smoke)

Runs against the stub integrations (`INTEGRATIONS_MODE=stub`, `CERTIFIER_ENABLED=false`, `WHATSAPP_ENABLED=false`) — no real Certifier.io / Resend / WABA calls.

## Prereqs

```bash
export MONGODB_URI="mongodb://localhost:27017/india-learns-dev"
npm install
npm run seed -w api
npm run dev -w api &    # port 4000
```

The seed creates:
- Admin → `admin@luc.local` / `Admin#12345`
- Finance → `finance-seed-1@luc.local` / `Finance#12345`
- Faculty → `faculty-seed-1@luc.local` / `Faculty#12345`
- Student (`IL-2026-0001`) → `student-seed-1@luc.local` / `Student#12345`
- Marks the seeded enrolment `completed=true` and auto-issues a certificate via the `course.completed` listener (stub URL: `https://stub.indialearns.com/cert/<hash>`).
- NotificationPrefs row for every user (defaults).
- Seven `ApiCostLedger` rows so analytics summary has non-zero api-cost data.

Grab access tokens for each role — seed logs them, or use:

```bash
ADMIN_AT=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@luc.local","password":"Admin#12345"}' | jq -r .data.accessToken)

STUDENT_AT=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"student-seed-1@luc.local","password":"Student#12345"}' | jq -r .data.accessToken)
```

## Certificates

### 1. Auto-issue via listener (already happened during seed)

```bash
curl -s -H "authorization: Bearer $STUDENT_AT" \
  http://localhost:4000/v1/me/certificates | jq
```

Expected: `data.items` length 1, `certificateUrl` populated, `issuedAt` non-null, `issueError` null.

### 2. Admin retry (idempotent — returns existing URL)

```bash
EID=$(curl -s -H "authorization: Bearer $ADMIN_AT" \
  http://localhost:4000/v1/enrollments?studentId=<student-id> | jq -r '.data.items[0].id')

curl -s -X POST -H "authorization: Bearer $ADMIN_AT" \
  http://localhost:4000/v1/enrollments/$EID/issue-certificate | jq
```

Expected: `data.reissued: true`, HTTP 200, same `certificateUrl` as step 1.

### 3. Student dashboard shows the cert bucket

```bash
curl -s -H "authorization: Bearer $STUDENT_AT" \
  http://localhost:4000/v1/students/me/dashboard | jq '.data.certificates'
```

Expected: `{ "count": 1, "latestIssuedAt": "2026-..." }`.

## Notifications + prefs

### 4. Fetch defaults

```bash
curl -s -H "authorization: Bearer $STUDENT_AT" \
  http://localhost:4000/v1/me/notification-prefs | jq
```

Expected: `emailByType.certificate.issued = true`, `whatsappByType.certificate.issued = false`, `whatsappByType."fees.due.today" = true`.

### 5. Opt out of an email channel

```bash
curl -s -X PATCH -H "authorization: Bearer $STUDENT_AT" \
  -H 'content-type: application/json' \
  -d '{"emailByType":{"timetable.change":false}}' \
  http://localhost:4000/v1/me/notification-prefs | jq '.data.emailByType["timetable.change"]'
```

Expected: `false`. Subsequent GET confirms persistence.

### 6. Reject WhatsApp on non-allowlist type (422)

```bash
curl -s -X PATCH -H "authorization: Bearer $STUDENT_AT" \
  -H 'content-type: application/json' \
  -d '{"whatsappByType":{"certificate.issued":true}}' \
  http://localhost:4000/v1/me/notification-prefs | jq
```

Expected: HTTP 422, `error.code = VALIDATION_FAILED`.

### 7. TRD §5.11 canonical list path

```bash
curl -s -H "authorization: Bearer $STUDENT_AT" \
  http://localhost:4000/v1/me/notifications | jq '.data.items | length'
```

Expected: ≥ 1 (the certificate-issued notification).

## Analytics

### 8. Admin dashboard summary

```bash
time curl -s -H "authorization: Bearer $ADMIN_AT" \
  http://localhost:4000/v1/analytics/summary | jq '. | .data | {students, admissions, fees, apiCost}'
```

Expected: HTTP 200, <500ms, non-zero `apiCost.thisMonthPaise` (seeded rows), sparkline arrays length 14. Second call is served from the 5-min cache.

### 9. SLA breach report

```bash
curl -s -H "authorization: Bearer $ADMIN_AT" \
  "http://localhost:4000/v1/analytics/sla-breaches?week=2026-W17" | jq
```

Expected: HTTP 200, `weekStart`/`weekEnd` populated, `byCategory` array.

### 10. Role gating

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "authorization: Bearer $STUDENT_AT" \
  http://localhost:4000/v1/analytics/summary
```

Expected: `403`.

## Retry sweep cron

### 11. HMAC-signed job invocation

```bash
# Sign + POST (uses the JOB_SECRET from .env)
node -e "
import('./api/src/middleware/requireJobAuth.js').then(m => {
  const s = m.signJobRequest({});
  console.log('x-job-timestamp:', s.timestamp);
  console.log('x-job-signature:', s.signature);
});
"

curl -s -X POST \
  -H 'content-type: application/json' \
  -H "x-job-timestamp: <ts>" \
  -H "x-job-signature: <sig>" \
  http://localhost:4000/v1/jobs/notifications-retry -d '{}' | jq
```

Expected: HTTP 200, `data: { processed, succeeded, failed, skipped }`. Unsigned call → 401.

## Cleanup

```bash
pkill -f 'node.*api'
```

## Verified on

- 2026-04-22 by Vidit (stub-mode smoke; Certifier.io live smoke blocked on Q-PENDING-08 API key).
