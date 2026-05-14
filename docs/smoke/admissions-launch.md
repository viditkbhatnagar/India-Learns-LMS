# Admissions module — pre-launch smoke checklist

Mirrors `docs/smoke/m9-launch.md` style. Walk this every time the admissions module is deployed to staging or production. Tick items as you go.

## 1. Health

- [ ] `GET /health` returns `{ok: true}` on the deployed origin.
- [ ] `GET /healthz` returns the same (Render's default probe path).
- [ ] Render dashboard shows the latest commit deployed.
- [ ] `GET /v1/admissions/apply/programs` returns `200` (empty list OK).
- [ ] `GET /v1/admissions/referee/not-a-real-token` returns `410 TOKEN_EXPIRED`.

## 2. Admin → admissions config (PR #21)

- [ ] Log in as superadmin → **Admin → Programs**. Each program is clickable.
- [ ] Click a program → land on `/admin/programs/:id/admissions`.
- [ ] Toggle **Admissions enabled** ON, pick **cohort_pick**, set fee ₹500, save. Toast / "Last saved" timestamp updates.
- [ ] Add a 3rd document slot ("Resume / CV") with required=false. Save.
- [ ] Toggle **Require statement** ON, word limit 800. Save.
- [ ] **Admin → Batches** → click any batch on that program → toggle **Open for applications** ON, set seats remaining 30. Save.
- [ ] Public `GET /v1/admissions/apply/programs` now returns that program.
- [ ] Public `GET /v1/admissions/apply/programs/:id/cohorts` returns 1 cohort with `seatsRemaining: 30`.

## 3. Applicant funnel (PR #20)

In an **incognito window**:

- [ ] Visit `/apply` — landing page renders.
- [ ] Click **Start application** → `/apply/signup` — sign up with `smoke-applicant-<timestamp>@example.com`. Application code `APP-YYYY-NNNNN` returned.
- [ ] Land in `/apply/portal` showing `state: draft`.
- [ ] Click **Continue application** → `/apply/form`. Walk Steps 2–5. Save and exit; log back in; draft restored.
- [ ] Step 6 (`/apply/documents`) — upload a PDF for gov ID + transcript. 11MB file is rejected client-side.
- [ ] Step 7 (`/apply/statement`) — word counter updates; saving > 800 words is rejected.
- [ ] Step 8 (`/apply/references`) — add a referee. (Email not delivered on stub mode; that's expected.)
- [ ] Step 10 (`/apply/submit`) — tick all 5 consents. Submit → confirmation page shows code.
- [ ] Portal shows state=`submitted`. Fee panel appears showing amount + "Amount due ₹500".

## 4. Officer review + admit gate (PR #20 + M6)

Back as superadmin:

- [ ] **Admissions → Applications** — funnel summary cards show non-zero counts.
- [ ] Click the new application — detail page loads with documents (3), referee row, statement, all 5 consents with timestamps, fee panel showing `pending`.
- [ ] Try clicking **Admit** → returns `402 FEE_REQUIRED` / error toast — admit blocked by unpaid fee.
- [ ] **Record payment** in the fee panel → ₹500, UPI, ref "TEST-001". Fee flips to `paid`.
- [ ] (Alternative test:) Click **Waive** with reason "smoke" → fee flips to `waived`.
- [ ] Add a reviewer note "smoke ok".
- [ ] Click **Admit** → succeeds. State = `admitted`.
- [ ] Audit chain panel shows 4+ entries (`viewed`, `note_added`, `application_fee.recorded` (or `application_fee.waived`), `decision.admit`) with **Verified** badge.
- [ ] `GET /v1/admissions/officer/applications/:id/audit` returns `verified: true`.

## 5. Applicant → Student conversion (M7)

Back in incognito window as the applicant:

- [ ] Portal shows the green "You've been admitted" panel with Accept / Decline buttons.
- [ ] Click **Accept offer** → confirmation alert with the new Student ID (`IL-YYYY-NNNN`).
- [ ] Redirected to `/login`. Log in with the same credentials.
- [ ] Land in `/student/dashboard`. The new student appears with their cohort + courses (if any are seeded on the program).
- [ ] In Mongo (`db.users.findOne({email: 'smoke-applicant-…'})`): role=`student`, code=`IL-…`, programId + batchId set.
- [ ] In Mongo (`db.batches.findOne({_id: ...batchId})`): `seatsRemaining` decremented by 1.

## 6. Analytics + CSV export (M8)

- [ ] **Admissions → Applications** funnel cards reflect the new state distribution (1 admitted, 0 elsewhere).
- [ ] Click **Export CSV →** → file downloads with `totals,by_program,time_to_decision,drop_off` rows.
- [ ] If multiple test apps exist: `timeToDecision.sampleSize > 0` with reasonable p50/p95 in hours.

## 7. Cron health (M3b + M9)

Render dashboard → **Crons** tab:

- [ ] `il-cron-fee-reminders` — last run succeeded.
- [ ] `il-cron-admissions-referee-reminders` — last run succeeded (or no-op with `evaluated: 0`).
- [ ] `il-cron-admissions-audit-head-snapshot` — last run captured the current head hash.
- [ ] `il-cron-admissions-draft-cleanup` — last run no-op (no orphan drafts older than 90 days yet).

## 8. Tamper-evidence spot check

- [ ] In Mongo: `db.admissionsauditlogs.updateOne({action: 'officer.note_added'}, {$set: {details: {preview: 'tampered'}}})`.
- [ ] Reload `/admissions/applications/:id` → Audit panel now shows red **Tampered** badge.
- [ ] **Undo immediately** (restore the prior `details` value) and reload — badge returns to green.

## 9. Negative paths

- [ ] Applicant tries `GET /v1/admissions/officer/applications` → `403 FORBIDDEN`.
- [ ] Applicant tries `GET /v1/students/me/dashboard` → `403 FORBIDDEN` (defensive role gate from M1).
- [ ] Public referee route with bad token → `410 TOKEN_EXPIRED`.
- [ ] Submit with missing required doc → `422 INCOMPLETE_APPLICATION` with `missing` list.
- [ ] PATCH /programs without admin role → `403`.

## 10. Cleanup (only on staging — never in production)

- [ ] Admin → Users → search "smoke-applicant" / "smoke-staging" → delete each test user.
- [ ] Admin → Programs → delete any `smoke-admissions-*` test programs.
- [ ] Confirm `db.applications.countDocuments({})` matches expected baseline.

## Sign-off

- [ ] Vidit Bhatnagar (engineering): _________
- [ ] Logan (LUC product owner): _________
- [ ] Rejin Rajan (LUC operations): _________

_Last reviewed: 2026-05-14 — Owner: Vidit Bhatnagar._
