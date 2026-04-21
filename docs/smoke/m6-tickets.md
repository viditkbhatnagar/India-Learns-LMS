# M6 — Tickets smoke test

Manual walkthrough exercising every surface in the ticket module. Pre-req: `npm run seed -w api` has run at least once against a local Atlas/Mongo. Uses `jq` for readability.

## 0. Env + seed

```bash
export MONGODB_URI="mongodb://localhost:27017/india-learns"
npm run seed -w api
API=http://localhost:4000
npm run dev -w api &
```

Seed output should mention `{ inserted: 3, skipped: 0 }` under `tickets seeded` on a first run.

## 1. Login as seeded student

```bash
ST=$(curl -sS -X POST $API/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"student-seed-1@luc.local","password":"Student#12345"}' \
  | jq -r .data.accessToken)
```

## 2. Student raises an academic ticket — auto-routed, code generated

```bash
curl -sS -X POST $API/v1/tickets \
  -H "authorization: Bearer $ST" -H 'content-type: application/json' \
  -d '{"category":"academic","subject":"Cannot play module 3 video","description":"Video buffers forever."}' \
  | jq '{code: .data.ticket.code, state: .data.ticket.state, assigneeUserId: .data.ticket.assigneeUserId, slaResolveDeadline: .data.ticket.slaResolveDeadline}'
# → { code: "TKT-ACAD-000003", state: "assigned", ... }
```

## 3. Complaint precondition

```bash
# Reset the seeded closed ticket to trigger the guard (for demo only)
# — in a fresh DB, just skip ahead. Expected 409:
curl -sS -X POST $API/v1/tickets \
  -H "authorization: Bearer $ST" -H 'content-type: application/json' \
  -d '{"category":"complaints","subject":"Escalation","description":"x"}' \
  | jq .error.code
# On a cleared DB: → "COMPLAINT_PRECONDITION_UNMET"
# After the seeded "closed" ticket exists: → 201 success
```

## 4. Staff ack — comment, firstAckAt flips, ticket advances to assigned

```bash
FT=$(curl -sS -X POST $API/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"faculty-seed-1@luc.local","password":"Faculty#12345"}' \
  | jq -r .data.accessToken)

TID=$(curl -sS $API/v1/staff/tickets -H "authorization: Bearer $FT" \
  | jq -r '.data.tickets[0].id')

curl -sS -X POST $API/v1/tickets/$TID/comments \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d '{"body":"Looking into this now."}' \
  | jq '{visibility: .data.comment.visibility}'
# → { visibility: "public" }
```

## 5. Staff transitions resolved → closed

```bash
curl -sS -X POST $API/v1/tickets/$TID/state \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d '{"to":"resolved","note":"Recompressed the MP4; pushing in the next build."}' \
  | jq .data.ticket.state
# → "resolved"

curl -sS -X POST $API/v1/tickets/$TID/state \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d '{"to":"closed"}' \
  | jq .data.ticket.state
# → "closed"
```

## 6. Student requests reopen — child ticket created

```bash
curl -sS -X POST $API/v1/tickets/$TID/reopen-request \
  -H "authorization: Bearer $ST" -H 'content-type: application/json' \
  -d '{"reason":"Still stuck on mobile."}' \
  | jq '{code: .data.ticket.code, parentTicketId: .data.ticket.parentTicketId}'
# → { code: "TKT-ACAD-000004", parentTicketId: "<original TID>" }
```

## 7. Staff direct-reopen — inside vs outside 7-day window

```bash
# Within 7 days — succeeds. Outside — 409 REOPEN_WINDOW_EXPIRED.
# Use the seeded closed ticket (subject "Module 1 PDF missing page 12",
# closed 2 days ago) to exercise the in-window case:
CLOSED=$(curl -sS $API/v1/me/tickets -H "authorization: Bearer $ST" \
  | jq -r '.data.tickets[] | select(.state=="closed") | .id' | head -n 1)

curl -sS -X POST $API/v1/tickets/$CLOSED/reopen \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d '{"note":"Received fresh complaint."}' \
  | jq .data.ticket.state
# → "in_progress"

# To demo the 8-day cliff: manually push closedAt back in the DB shell by 8 days
# and re-run — expected output `.error.code == "REOPEN_WINDOW_EXPIRED"` (409).
```

## 8. SLA cron — `POST /v1/jobs/sla-timers`

```bash
# HMAC headers — reuse the signJobRequest helper from the cron tests or:
TS=$(date +%s)
BODY='{}'
SIG=$(node -e "const c=require('crypto'); \
  console.log(c.createHmac('sha256', process.env.JOB_SECRET || 'change-me-dev-only') \
    .update('$BODY' + $TS).digest('hex'))")

curl -sS -X POST $API/v1/jobs/sla-timers \
  -H "x-job-signature: $SIG" -H "x-job-timestamp: $TS" \
  -H 'content-type: application/json' -d "$BODY" \
  | jq '{processed, ackBreached, resolveBreached}'
# → { processed: 0|N, ackBreached: 0|N, resolveBreached: 0|N }

# Run twice — second call always shows 0 breached (idempotent).
```

## 9. Fees-suspension whitelist (D-052)

```bash
# Turn the seeded student into a fees-suspended user (run in mongosh):
#   db.users.updateOne({email: 'student-seed-1@luc.local'},
#     { $set: { status: 'suspended', suspensionKind: 'fees' } })

# Student still lists their tickets:
curl -sS -o /dev/null -w '%{http_code}\n' $API/v1/me/tickets -H "authorization: Bearer $ST"
# → 200

# Can post a finance ticket:
curl -sS -o /dev/null -w '%{http_code}\n' -X POST $API/v1/tickets \
  -H "authorization: Bearer $ST" -H 'content-type: application/json' \
  -d '{"category":"finance","subject":"Payment receipt issue","description":"x"}'
# → 201

# Academic ticket is blocked:
curl -sS -X POST $API/v1/tickets \
  -H "authorization: Bearer $ST" -H 'content-type: application/json' \
  -d '{"category":"academic","subject":"y","description":"z"}' \
  | jq .error.code
# → "FEES_SUSPENDED"
```

## Expected state after smoke

- 3 seeded tickets + the ones created above.
- Audit log entries: `ticket.created`, `ticket.assigned`, `ticket.comment.added`, `ticket.state_changed` (×2), `ticket.reopen_requested`, `ticket.reopened`, `jobs.sla_timers.invoked`.
- Notifications: `ticket.created`, `ticket.commented`, `ticket.state_changed`; email dispatched to assignee + student (WhatsApp skipped unless `WHATSAPP_ENABLED=true`).
- `npm test -w api` — 316 tests green.
