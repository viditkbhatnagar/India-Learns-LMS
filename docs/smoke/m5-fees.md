# M5 — Fees + Suspension · smoke walkthrough

Server-only flow; exercises fee structures, invoice generation, payment with
auto-receipt, student fees view, reminder + auto-suspend cron, admin override.

## Prerequisites

```bash
# From repo root
MONGODB_URI="mongodb://localhost:27017/india-learns" npm install
MONGODB_URI="mongodb://localhost:27017/india-learns" npm run seed -w api
MONGODB_URI="mongodb://localhost:27017/india-learns" npm run dev -w api &
```

Seed creates:
- Two programs (Aviation, Retail & Fashion)
- One faculty + one admin super
- One Aviation fee structure with registration (₹10k one-time), tuition
  (monthly_x=3, ₹60k total), exam (one-time ₹4k)
- One seeded student IL-2026-0001 (`student-seed-1@luc.local` / `Student#12345`)
- One seeded finance user (`finance-seed-1@luc.local` / `Finance#12345`)
- One active enrolment + generate-fees (4 installments)
- One sample ₹10,000 registration payment → Receipt PDF

## 1. Authenticate

```bash
FT=$(curl -sS -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"finance-seed-1@luc.local","password":"Finance#12345"}' | jq -r .data.accessToken)

ST=$(curl -sS -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"student-seed-1@luc.local","password":"Student#12345"}' | jq -r .data.accessToken)
```

## 2. Fee structures (admin-created; finance reads)

```bash
curl -sS http://localhost:4000/v1/fee-structures -H "authorization: Bearer $FT" | jq
```

Returns the seeded structure with 3 components.

## 3. Generate fees (idempotent)

```bash
ENR=$(curl -sS "http://localhost:4000/v1/enrollments/me" -H "authorization: Bearer $ST" | jq -r '.data.enrolments[0].id')

# First call was made by the seed; re-running returns createdCount=0.
# Use an admin token for real generation if needed.
AT=<admin_access_token>
curl -sS -X POST "http://localhost:4000/v1/enrollments/$ENR/generate-fees" \
  -H "authorization: Bearer $AT" | jq '.data | {createdCount, skippedCount}'
```

## 4. Record a manual payment → Receipt PDF

```bash
# Student id
SID=$(curl -sS http://localhost:4000/v1/users/me -H "authorization: Bearer $ST" | jq -r .data.user.id)

curl -sS -X POST http://localhost:4000/v1/payments \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d "{\"studentId\":\"$SID\",\"amountPaise\":2000000,\"method\":\"upi\",\"reference\":\"UPI-TXN-001\"}" \
  | jq '{payment: .data.payment.id, receiptCode: .data.receipt.code, creditNote: .data.creditNote}'
```

→ first tuition installment paid (₹20k). Second payment of the same amount
finishes tuition installment 2, etc.

```bash
REC=$(curl -sS -X POST http://localhost:4000/v1/payments ... | jq -r .data.receipt.id)
curl -sS -o /tmp/receipt.pdf -w '%{http_code}\n' \
  "http://localhost:4000/v1/receipts/$REC/download" \
  -H "authorization: Bearer $FT"
# → 200; file is a valid PDF
file /tmp/receipt.pdf    # PDF document, version 1.3
```

In `INTEGRATIONS_MODE=stub` the endpoint streams the PDF bytes directly from
the per-process cache. In `live` mode it returns a Cloudinary signed URL
(1 h TTL).

## 5. Student fees view

```bash
curl -sS http://localhost:4000/v1/students/me/fees -H "authorization: Bearer $ST" \
  | jq '{totalPaise, paidPaise, balancePaise, nextDueDate, accessState}'
```

## 6. Cron — fee reminders (HMAC-signed)

```bash
TS=$(date +%s)
SIG=$(node -e "const c=require('crypto'); const s=c.createHmac('sha256','$JOB_SECRET'); s.update('{}'+'$TS'); console.log(s.digest('hex'))")
curl -sS -X POST http://localhost:4000/v1/jobs/fee-reminders \
  -H "x-job-signature: $SIG" -H "x-job-timestamp: $TS" \
  -H 'content-type: application/json' -d '{}' | jq
```

Invalid/missing signature → 401 UNAUTHENTICATED. Stale timestamp (> 5 min) → 401.

## 7. Auto-suspend cron

```bash
SIG=$(node -e "...")  # same HMAC recipe
curl -sS -X POST http://localhost:4000/v1/jobs/autosuspend \
  -H "x-job-signature: $SIG" -H "x-job-timestamp: $TS" \
  -H 'content-type: application/json' -d '{}' \
  | jq '{evaluated, suspended, lifted, warned1, warned2}'
```

## 8. Admin override

```bash
curl -sS -X POST "http://localhost:4000/v1/users/$SID/suspension/override" \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"until":"2026-06-30T00:00:00+05:30","reason":"Finance waived pending reconciliation"}' \
  | jq .data.user.suspensionOverrideUntil
```

Subsequent `GET /v1/me/courses` with the student's bearer → 200 (override
lifts the 403 FEES_SUSPENDED guard).

`DELETE /v1/users/$SID/suspension/override` revokes the grace window; if the
student still has overdue installments, reconcile re-suspends immediately.

## 9. Suspended-access behaviour (D-021 / PRD §9.5)

A fees-suspended student still sees:
- `GET /v1/students/me/fees` ✓
- `GET /v1/users/me` ✓
- `POST /v1/auth/logout` ✓
- `GET /v1/notifications/me` ✓
- `GET /v1/receipts/:id/download` ✓
- (M6 will add `POST /v1/tickets { category: "Finance" }` ✓)

Every other route returns 403 `FEES_SUSPENDED`.

Manual-suspended students remain hard-blocked at `requireAuth`.
