# Quick Start — Staff

A one-page guide for your first day on India Learns as faculty, admin, or finance. Pick your role's row in §3 to land on the right handbook for deeper detail.

## 1. Activate your account (5 min)

1. Open the email titled **"Welcome to India Learns — Activate your account"**.
2. Click the magic link (valid 7 days).
3. Set a password — at least 10 characters, one letter, one digit, not one of your last three.
4. You're in.

## 2. The dashboard is your home

| Role | Dashboard |
|---|---|
| Faculty | `/faculty/dashboard` |
| Admin / Superadmin | `/admin/dashboard` |
| Finance | `/finance/dashboard` |

Everything important — pending tasks, KPIs, alerts — surfaces there.

## 3. By role: the three things to know on Day 1

### Faculty

1. **Find your courses** at `/faculty/courses`. Open one to enter the **Course Shell** (Overview / Content / Gradebook).
2. **Take attendance** in a session before marking it complete.
3. **Drafts vs Publish**: grades you save are private until you click **Publish**.

→ Full guide: [faculty-handbook.md](faculty-handbook.md).

### Admin

1. **Invite users** at `/admin/users` → **Invite user**. Magic-link expires in 7 days.
2. **Triage tickets** at `/admin/tickets`. Watch the SLA breaches dashboard.
3. **Build the timetable** at `/admin/timetable`. Add holidays at `/admin/holidays`.

→ Full guide: [admin-handbook.md](admin-handbook.md).

### Finance

1. **Record a payment** at `/finance/students/:id/record-payment`. Choose method, reference, amount, allocate to instalments.
2. **A receipt is auto-generated** and emailed to the student. Download URL is signed (5-min TTL).
3. **Reverse, don't edit** — to fix an error, reverse the payment and re-record.

→ Full guide: [finance-handbook.md](finance-handbook.md).

## 4. Common to all staff

### Sign-in security

- 10 wrong passwords in 15 min → 30-minute lockout.
- Don't share credentials.
- If you suspect compromise, change your password — that signs you out everywhere.

### Tickets

Staff see tickets at `/staff/tickets`. Use **internal comments** for staff-only notes; **public comments** are visible to the requester.

State machine: **Open → Acknowledged → In progress → Resolved → Closed**. Resolved tickets can be reopened by the requester for 15 days.

### Audit log

Every write you make is audited. `/admin/audit-logs` shows the trail. Treat it as a safety net, not a deterrent.

### Privacy

- **Don't share student PII outside the platform.**
- **Don't extract data into spreadsheets.** Use platform reports.
- **Treat ticket free-text as sensitive** — it can include personal narrative.

## 5. Where to get help

| Issue | Where |
|---|---|
| App is broken | Open a Technical ticket OR ping Vidit |
| You're locked out | Wait 30 minutes or use Forgot Password |
| You don't know how to do something | This handbook → [FAQs](faqs.md) → [Support channels](support-channels.md) |
| Production incident | [On-call runbook](../operations/on-call-runbook.md) |

## 6. Where to go next

- [FAQs](faqs.md) — quick answers.
- Your role's full handbook (above).
- [Operations runbook](../operations/on-call-runbook.md) — when something is broken.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release._
