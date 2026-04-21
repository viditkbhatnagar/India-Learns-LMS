# PROMPTS.md — Claude Code build prompts for India Learns

This file is a copy-paste script for driving Claude Code through the full build. Run the prompts **in order**. Each milestone has:

1. A **prompt block** you paste into Claude Code.
2. A **DoD check** — what you should verify before moving to the next milestone.

Do not skip ahead. Claude Code works best when each milestone lands cleanly (tests green, DoD ticked) before the next one starts.

> **Where this file and `CLAUDE.md` live:** both at the **repo root** (alongside the `claude-code-docs/` folder). Claude Code auto-reads `CLAUDE.md` from the project root on every session — that's why it's there and not buried in the doc pack.
>
> **Doc pack:** lives at `./claude-code-docs/`. Keep that folder untouched — it's the source of truth.

---

## Cross-session memory — read this before every prompt

Every milestone is a fresh Claude Code session. To carry context across sessions, **every prompt below assumes Claude Code follows the memory protocol in `CLAUDE.md §10`**:

- **Session start:** read `/CLAUDE.md` → `/memory/index.md` → `/TASKS.md` → `/memory/milestones/M{N-1}*.md`.
- **Session end:** update `/memory/decisions.md`, write `/memory/milestones/M{N}-*.md`, update `/TASKS.md`, update `/memory/open-questions.md`, commit with `chore(memory): checkpoint after M{N}`.
- **Skills:** use `productivity:memory-management`, `productivity:task-management`, `productivity:update` explicitly — don't just write files.

If a new session can't find `/memory/` yet, it means M1 hasn't run — run **Prompt 0** first, which creates the folder.

---

## Prompt 0 — Kickoff / repo initialisation

Paste this **once**, in an empty repo (or empty folder) where you want the project to live.

```
You are building India Learns, an LMS for LUC's in-person Diploma Programs in India. The full specification is in ./claude-code-docs/. Read these files, in this order, before writing any code:

1. /CLAUDE.md                        — your operating manual (at repo root)
2. claude-code-docs/01_BRD.md        — business requirements (why)
3. claude-code-docs/02_PRD.md        — product requirements (what)
4. claude-code-docs/03_TRD.md        — technical requirements (how)
5. claude-code-docs/04_UI_UX_Spec.md — design system + screen inventory
6. claude-code-docs/05_Deployment_Runbook.md — infra + go-live
7. /PROMPTS.md                       — the milestone-by-milestone prompt script (this file)

Source-of-truth hierarchy when docs disagree: TRD > PRD > BRD > UI/UX. If any ambiguity remains after reading all six, STOP and ask me before coding. Do not invent features not in the docs. Do not scope-creep into Phase 2 items listed in BRD §6.2.

**Memory bootstrap (do this FIRST in M1 — required by CLAUDE.md §10):**

1. Invoke the `productivity:memory-management` skill and the `productivity:start` skill. Follow their instructions.
2. Create the `/memory/` folder per CLAUDE.md §10 with these files seeded from the doc pack:
   - `/memory/index.md` — table of contents
   - `/memory/glossary.md` — LUC, AGI LMS, WABA, DPDP Act, Certifier.io, PWA, MERN, Paise, IST, Mumbai (ap-south-1), etc. — pulled from doc pack terms
   - `/memory/people.md` — seeded from BRD §4 (Rejin Rajan, Logan, Vidit, pending: Finance operator, Content manager, IT admin)
   - `/memory/decisions.md` — seeded with the key locked decisions (MERN, Render + Atlas Mumbai, Argon2id, magic-link invite, 3 WhatsApp templates, no AI in Phase 1, stricter Complaint precondition)
   - `/memory/open-questions.md` — seeded from CLAUDE.md §8 PENDING items (logo SVG, GST, domain DNS, Finance operator)
   - `/memory/milestones/` — empty directory
3. Create `/TASKS.md` at the repo root with the M1–M9 milestone breakdown as top-level tasks, and the M1 sub-tasks checked off as you complete them.
4. At session end, write `/memory/milestones/M1-foundations.md` per CLAUDE.md §10 end-of-session protocol, and commit everything as `chore(memory): checkpoint after M1`.

Your first milestone is M1 (Foundations) from CLAUDE.md §4. Deliver:

- A monorepo using npm workspaces with packages: /api, /web, /packages/shared-types
- Node 20 LTS + TypeScript (ESM, "type": "module") across all packages
- /api: Express 4 + Mongoose 8 + pino + helmet + zod + vitest + supertest + mongodb-memory-server
- /web: React 18 + Vite 5 + Tailwind 3 + vite-plugin-pwa + React Router 6
- /packages/shared-types: pure TS types shared by /api and /web
- ESLint + Prettier config at repo root, shared by all workspaces
- .env.example files per package listing every env var from TRD §13
- GitHub Actions CI: lint + typecheck + unit tests on push
- Commit convention: conventional commits. Initial commit = "chore: scaffold monorepo"

Do NOT touch auth, models, or business logic yet. M1 is only scaffolding + a /health endpoint on /api returning { ok: true, commit: <sha> } and a Vite "Hello India Learns" landing page on /web. Get the CI green before declaring M1 done.

Report back with the repo tree and the CI run URL.
```

**DoD check for M1:**
- `npm install` at root installs everything.
- `npm run dev` boots `/api` (port 4000) and `/web` (port 5173) concurrently.
- `curl http://localhost:4000/health` returns `{ok:true,...}`.
- CI green on first push.

---

## Per-milestone boilerplate (auto-prepend to Prompts 1–8)

Every milestone prompt from M2 onward silently begins with this session-start block. If you're pasting a milestone prompt into a fresh Claude Code session, paste THIS block first, then the milestone prompt:

```
Session-start protocol (CLAUDE.md §10):

1. Read /CLAUDE.md in full.
2. Invoke the `productivity:memory-management` skill and run the `productivity:update` skill to sync task state.
3. Read /memory/index.md, follow links, load relevant entries.
4. Read /TASKS.md.
5. Read /memory/milestones/M{N-1}*.md for context from the previous milestone.
6. Re-read the spec sections cited in the next milestone prompt.

Do NOT skip this. If /memory/ is missing, say so and stop — M1 wasn't run.

At session end (before reporting back):

1. Append decisions to /memory/decisions.md with date + rationale + spec reference.
2. Write /memory/milestones/M{N}-<name>.md with what was built, tests passing, files changed, open items.
3. Update /TASKS.md — tick done, add new.
4. Update /memory/index.md + /memory/open-questions.md as needed.
5. Commit: `chore(memory): checkpoint after M{N}`.

Also: invoke `security-review` and `review` skills on any auth/fees/ticket changes before you report done.
```

---

## Prompt 1 — M2 Auth + user management

```
M1 is signed off. Proceed to M2 (Auth + users) per CLAUDE.md §4.

Read TRD §5 (User + InviteToken + RefreshToken schemas), §7 (/v1/auth/* + /v1/users/* endpoints), §10 (security), and PRD §4 (role permissions matrix) and §5 (global auth behavior). Then build:

1. Mongoose models: User, InviteToken, RefreshToken per TRD §5 — exact field names and indexes.
2. Password hashing with Argon2id (argon2 package), memory cost per TRD §10.2.
3. JWT access tokens via jose (15 min TTL) + refresh tokens (14 days, rotating, stored hashed in RefreshToken collection). Session cap: 5 devices per user (oldest evicted).
4. Magic-link invite flow:
   - POST /v1/auth/invite (admin only) → creates InviteToken (7-day TTL, single use), sends email via Resend adapter (stub ok, just log payload), queues WhatsApp welcome template (also stubbed).
   - GET  /v1/auth/invite/:token → validates.
   - POST /v1/auth/accept-invite → sets password, marks InviteToken used, issues tokens, returns user.
5. POST /v1/auth/login (email+password). Rate-limit: 5 attempts per 15 min per (ip+email) using express-rate-limit with redis-free memory store (it's fine for M2; we'll swap later).
6. POST /v1/auth/refresh with rotation; reject reused refresh tokens (reuse = whole family invalidated).
7. POST /v1/auth/logout — revokes the refresh token presented.
8. GET /v1/users/me.
9. Admin-only user CRUD: GET /v1/users (paginated, filterable by role), POST /v1/users (admin creates student/faculty/finance accounts), PATCH /v1/users/:id, DELETE /v1/users/:id (soft delete — set status=deleted, keep record for audit).
10. Role-based middleware: requireAuth, requireRole(...roles). Wire into every protected route.
11. Audit log (AuditLog model per TRD §5) on every staff write. Include actor userId, action verb, target collection+id, diff snapshot, timestamp.

Integration stubs: create packages/shared-types/integrations.ts with the EmailAdapter and WhatsAppAdapter interfaces from TRD §9. Implement `ConsoleEmailAdapter` and `ConsoleWhatsAppAdapter` for dev — they log instead of sending. Wire via env var INTEGRATIONS_MODE=stub|live (stub is default in dev/test).

Tests required (vitest + supertest + mongodb-memory-server):
- Unit tests for password hash/verify.
- Integration tests: full invite→accept→login→refresh→logout flow; rate-limit triggers after 5 bad logins; admin can create/edit/delete users; non-admin cannot; soft-deleted users cannot log in.
- Coverage gate: 70% on /api/src/services/**.

Do NOT build any UI yet. M2 is server-only. Report back with:
- the API surface mounted (list of routes with methods)
- test run output
- example curl commands for the full invite flow
```

**DoD check for M2:**
- Invite → accept → login → refresh → logout runs cleanly via curl.
- Bad login lockout works.
- Admin CRUD respects role restrictions (try as faculty → 403).
- All staff writes appear in `auditlogs` collection.
- Coverage ≥ 70% on services.

---

## Prompt 2 — M3 Courses, modules, enrollment

```
M2 is signed off. Proceed to M3 (Courses + Modules + Enrollment) per CLAUDE.md §5.

Read TRD §5 (Program, Course, Module, Batch, Enrollment schemas), §7 (/v1/programs, /v1/courses, /v1/modules, /v1/batches, /v1/enrollments), PRD §6 (course access rules), PRD §4 (permissions), and UI/UX §6 (CourseScreen layout). Then build:

1. Mongoose models: Program, Course, Module, Batch, Enrollment per TRD §5. Seed the two Phase 1 programs (Aviation Diploma, Retail & Fashion Diploma) via a seed script at /api/scripts/seed.ts.
2. Admin endpoints for program/course/module/batch CRUD. Faculty can read everything they're assigned to but only edit Module content (not structure).
3. Enrollment endpoints:
   - POST /v1/enrollments (admin) — enrols a student in a program + assigns to a batch.
   - GET /v1/enrollments/me (student) — returns enrolments with program/batch/validity/feeStatus.
   - PATCH /v1/enrollments/:id (admin) — change batch, extend validity, mark complete.
4. File storage adapter: StorageAdapter interface per TRD §9. Implement ConsoleStorageAdapter (returns fake URLs) + CloudinaryStorageAdapter (real Cloudinary). Pick via INTEGRATIONS_MODE. Module assets = videos + PDFs; store asset pointers, not bytes.
5. Access control: a student can GET a module only if (enrolled in its course's program) AND (enrollment.accessState in ['active','warn1','warn2','override']) AND (enrollment.validUntil > now). No watch-time tracking. No per-page PDF tracking. We only record "module opened" for analytics — log to AuditLog with action='module.viewed'.
6. Student dashboard endpoint: GET /v1/students/me/dashboard → returns enrolled courses, next class (stub for now — M4 will wire real data), outstanding fees (stub — M5), open tickets count (stub — M6), new feedback count (stub — M7).

Tests:
- Admin can create a program → course → module tree; faculty assigned to the course can update module content but not delete modules; student can list their enrolments; suspended student gets 403 on GET /v1/modules/:id.
- Seed script idempotent (running twice doesn't duplicate).

Report back with:
- Seeded programs/courses visible via GET /v1/programs
- A working student dashboard payload for a seeded student
- Test run output
```

**DoD check for M3:**
- Seed script runs clean on empty DB and on seeded DB (idempotent).
- Suspended enrollment blocks module access.
- Staff permissions separate cleanly (faculty ≠ admin).

---

## Prompt 3 — M4 Timetable

```
M3 is signed off. Proceed to M4 (Timetable) per CLAUDE.md §5.

Read TRD §5 (TimetableEntry, TimetableOverride, Holiday), §7 (/v1/timetable/*), PRD §7 (timetable rules), UI/UX §6 (TimetableScreen).

Build:

1. Models: TimetableEntry (weekly recurring, per batch), TimetableOverride (one-off cancellations / reschedules / extras), Holiday (all batches affected).
2. Admin CRUD: POST/PATCH/DELETE /v1/timetable/entries, same for /overrides and /holidays.
3. Student view: GET /v1/timetable?batchId=&from=&to= → returns resolved occurrences in the window, with recurring entries expanded, overrides applied, holidays removed.
4. "Next class" helper: getNextClassForStudent(userId) — used by the dashboard.
5. Notifications: on override create/update/delete, enqueue notification (type=timetable.change) to every student in the batch. Use NotificationService with the in-app + email channels (WhatsApp NOT used for timetable per BRD §6.1 — WhatsApp is only Fee Due, Payment Received, Ticket Updated).

Timezone rule: store entries in IST (Asia/Kolkata) but always return ISO-8601 with +05:30 offset to clients. No UTC conversions in the UI.

Tests:
- Weekly recurring entry produces correct occurrences across DST-free range (India has no DST; verify trivially).
- Override correctly overrides the occurrence (cancel, reschedule, add).
- Holiday hides all affected occurrences.
- Notification queued on override create.

Report back with GET /v1/timetable output for the seeded Aviation batch for next 14 days.
```

**DoD check for M4:**
- Override correctly mutates a single week's occurrence.
- Holiday removes a day across all batches.
- Student dashboard's "next class" returns the right session.

---

## Prompt 4 — M5 Fees, reminders, auto-suspension

```
M4 is signed off. Proceed to M5 (Fees + suspension) per CLAUDE.md §5. This is the highest-stakes milestone — Finance workflows. Build carefully.

Read TRD §5 (FeeStructure, Invoice, Installment, Payment, Receipt, CreditNote), §7 (/v1/fees/*, /v1/finance/*), §8 (cron schedule), PRD §8 (fee lifecycle, reminder schedule, auto-suspension state machine), BRD BR-04, BR-05.

Build:

1. Models per TRD §5. Money stored as integer paise. Use Decimal128 ONLY for cross-currency scenarios (not applicable here — INR only).
2. Admin creates FeeStructure per program. On enrolment, system generates Invoice + Installments per the structure. Default: 3 installments = 40% / 30% / 30% at T0, T+60, T+120 days from enrolment date (make configurable in FeeStructure).
3. Finance endpoints:
   - GET  /v1/finance/invoices?status=&studentId=  — paginated
   - POST /v1/finance/payments  — records a manual payment; applies to oldest unpaid installment first; issues Receipt (PDF via pdfkit, upload to Cloudinary); if overpayment → CreditNote.
   - POST /v1/finance/credit-notes/:id/apply — apply credit to next unpaid installment.
   - GET  /v1/finance/receipts/:id.pdf — signed short-lived download link.
4. Student endpoints:
   - GET /v1/students/me/fees → totalFees, paid, balance, nextDueDate, nextDueAmount, installments[] with per-row status, receipts[].
5. Reminder schedule (PRD §8.3) — cron job every hour fires due notifications:
   - T-14: Heads-up (in-app + email)
   - T-7: Reminder (in-app + email + WhatsApp "Fee Due")
   - T0:  Due today (in-app + email + WhatsApp "Fee Due")
   - T+3: Overdue nudge (in-app + email)
   - T+14: **Warning 1** (in-app + email)
   - T+21: **Warning 2** (in-app + email)
   - T+28: **Auto-suspend** — flip enrollment.accessState to 'suspended', notify student + admin (in-app + email)
   Track which fire points have fired per Installment (installment.firedAt: { t_14, t_7, t_0, t_plus_3, warn1, warn2, suspend }) so the job is idempotent.
6. Auto-suspend cron runs daily at 03:30 IST (TRD §8). Admin can override via PATCH /v1/enrollments/:id/access-state with reason — logged to AuditLog; overrides unlock a 30-day grace window.
7. Receipt PDF: org name + GST (from env), student name, invoice ID, installment #, amount in words (Indian format — "Lakh/Crore"), mode of payment, date, signature image (from env URL, fallback blank).

Tests:
- Payment application: partial, exact, overpayment (credit note path), multi-installment allocation.
- Reminder firing points trigger once each; re-running cron doesn't double-fire.
- Auto-suspend: a student whose T+28 passes without payment is flipped to 'suspended', receives notification, dashboard shows suspension banner per UI/UX §6.
- Admin override clears suspension and logs audit entry.
- Receipt PDF renders with no undefined fields.

Report back with:
- A full payment lifecycle demo (curl) from invoice → payment → receipt PDF
- Cron simulation: run the reminder job at various synthetic "now" values and show the state transitions
```

**DoD check for M5:**
- Receipt PDF downloads and renders correctly.
- Reminder schedule fires exactly once at each point (check `firedAt` fields).
- Auto-suspend can be reproduced deterministically by time-travelling the clock in tests.
- Admin override works and is audited.

---

## Prompt 5 — M6 Ticketing

```
M5 is signed off. Proceed to M6 (Ticketing) per CLAUDE.md §5.

Read TRD §5 (Ticket, TicketComment), §7 (/v1/tickets/*), §8 (SLA cron), PRD §9 (ticket categories, state machine, complaint precondition, SLA definitions), BRD BR-06, BR-07.

Build:

1. Models per TRD §5. Categories enum: ['academic','administration','finance','technical','complaint']. State: ['open','assigned','in_progress','resolved','closed','reopened']. Assignees: routed by category per PRD §9.2.
2. Endpoints:
   - POST /v1/tickets (student) — creates a ticket. If category=='complaint', REJECT unless the student has at least one prior ticket in state in {'resolved','closed'}. Return canonical error TICKET_COMPLAINT_PRECONDITION_NOT_MET.
   - GET  /v1/tickets/me (student) / GET /v1/tickets (staff, scoped by role).
   - POST /v1/tickets/:id/comments (both sides) — threaded replies.
   - PATCH /v1/tickets/:id/state (staff only) — transitions with validation per state machine.
   - POST /v1/tickets/:id/reopen (student only) — allowed only if currentState in {'resolved','closed'} AND closedAt < 7 days ago. Else REOPEN_WINDOW_EXPIRED.
3. SLA tracking (PRD §9.5):
   - Acknowledgement SLA: 24 hours for all categories (first staff comment or state change from 'open').
   - Resolution SLA: 5 business days for non-Complaint, 15 business days for Complaint.
   - "Business day" = Mon–Fri, excluding Holiday records.
   - slaBreachedAt field set when breached; visible on admin dashboard.
4. Cron: every 30 minutes, check all open/assigned/in_progress tickets for SLA breach; set flags; notify assignee + admin on first breach.
5. Notifications:
   - New ticket → assignee (in-app + email).
   - Staff comment → student (in-app + email + WhatsApp "Ticket Updated").
   - Student comment → assignee (in-app + email).
   - State change → student (in-app + email).
6. Audit: every state change + assignment + comment logged.

Tests:
- Student cannot raise complaint without prior resolved/closed ticket.
- Reopen allowed at day 6, rejected at day 8.
- SLA breach flag sets deterministically via time-travel.
- State machine rejects illegal transitions (e.g. 'open'→'closed' without going through 'resolved').

Report back with full ticket lifecycle demo + SLA breach demo.
```

**DoD check for M6:**
- Complaint precondition enforced with canonical error code.
- 7-day reopen window exact.
- SLA breach visible on admin dashboard query.

---

## Prompt 6 — M7 Assessments + feedback

```
M6 is signed off. Proceed to M7 (Quizzes, Exams, Rubric feedback) per CLAUDE.md §5.

Read TRD §5 (Quiz, QuizAttempt, Exam, ExamAttempt, Rubric, FeedbackEntry), §7 (/v1/quizzes, /v1/exams, /v1/feedback), PRD §10 (assessment rules, rubric feedback model), BRD BR-08, BR-10.

Build:

1. Quiz + Exam models. Question types: mcq (auto-graded), essay (manual grade by faculty). Per TRD §5, quiz = module-level, exam = course-level.
2. Faculty endpoints: create/edit quiz+exam, publish, unpublish.
3. Student endpoints:
   - GET /v1/quizzes/:id (only if enrolled and within attempt window)
   - POST /v1/quizzes/:id/start → creates QuizAttempt with serverStartAt + deadline.
   - POST /v1/quizzes/attempts/:id/submit → locks attempt, auto-grades MCQs, flags essays for faculty.
   - Same pattern for exams.
4. Faculty grading UI endpoints: GET /v1/quizzes/attempts?needsGrading=true; PATCH /v1/quizzes/attempts/:id/grade (essay score + comment per question).
5. Rubric feedback (PRD §10.4):
   - Rubric = set of criteria with max scores; created by admin per course.
   - Faculty endpoint POST /v1/feedback — targets one of: assignment submission, module, assessment. Body = { rubricScores[], writtenFeedback, summaryFeedback }.
   - Student endpoint GET /v1/feedback/me — lists all feedback with newest first, unread badge.
   - One-way only: students cannot reply. (Replies = ticket in Academic category.)
6. Faculty weekly digest cron (Monday 09:00 IST, TRD §8): list of students awaiting feedback >7 days. Email via Resend adapter.
7. Certificate trigger: when a student's course completion criteria are met (all modules complete + passed final exam per PRD §10.6), publish event courseCompleted — M8 will consume it.

Tests:
- MCQ auto-grading correct for happy + tie + skip-all cases.
- Essay grading updates total score correctly.
- Rubric feedback enforces rubricScores length == criteria length.
- Faculty weekly digest lists only ungraded + >7-day feedback.

Report back with full attempt → grade → feedback demo.
```

**DoD check for M7:**
- Quiz auto-grade math correct.
- Faculty cannot grade outside their assigned courses.
- Rubric + written + summary feedback round-trip on student dashboard.

---

## Prompt 7 — M8 Certificates, notifications, analytics

```
M7 is signed off. Proceed to M8 (Certificates + Notifications + Analytics) per CLAUDE.md §5.

Read TRD §5 (Notification, Certificate), §7 (/v1/certificates, /v1/notifications, /v1/admin/analytics), §9 (Certifier.io adapter), PRD §11 (certificates), PRD §12 (notification registry), PRD §13 (analytics), BRD BR-10, BR-13.

Build:

1. CertificateAdapter interface per TRD §9 with CertifierIoAdapter + ConsoleCertificateAdapter. Listen for courseCompleted events → call adapter.issue(student, course) → store Certificate record with provider ID + public verify URL.
2. Student endpoint: GET /v1/certificates/me → list with download URLs. UI screen is CertificateScreen (UI/UX §6).
3. Full notification system (PRD §12):
   - Notification model per TRD §5 with channels: in_app, email, whatsapp.
   - NotificationService.enqueue(event, payload) → fan-out per recipient preferences + channel mappings.
   - WhatsApp limited to 3 templates (Fee Due, Payment Received, Ticket Updated). Enforce template allowlist in the WhatsApp adapter.
   - Worker cron every minute drains the queue, dispatches via adapters, marks sent/failed with retry (3 attempts, exponential backoff).
   - GET /v1/notifications/me — in-app list with unread counter, mark-read endpoint.
4. Admin analytics endpoints (PRD §13): GET /v1/admin/analytics/:metric where metric is one of:
   - students-by-status (count by accessState)
   - enrolments-by-program (30/90/365 day windows)
   - quiz-performance (avg, p50, p90 per course)
   - sla-breaches (count breached in window, by category)
   - api-cost (from internal cost-tracking table — seed with per-event cost constants from TRD §13.5)
5. Dashboard data endpoints aggregated: GET /v1/admin/dashboard → all tiles in one call per UI/UX §6 AdminDashboard.

Tests:
- Certificate issued exactly once per (student, course) — idempotent.
- WhatsApp adapter rejects template IDs outside allowlist.
- Notification worker retries on transient adapter errors; dead-letters after 3 attempts.
- Analytics queries honour window filter.

Report back with a full "student completes course → certificate issued → email + in-app notification" demo.
```

**DoD check for M8:**
- Certificate ID appears on student dashboard with working verify link.
- WhatsApp template allowlist enforced (try sending a non-allowlisted template → rejected).
- Admin dashboard returns all tiles in one call under 500ms with seeded data.

---

## Prompt 8 — M9 Polish, UI build-out, deploy

```
M8 is signed off. This is the final milestone — M9 (Polish + deploy) per CLAUDE.md §5.

Read UI/UX Spec end-to-end + Deployment Runbook end-to-end.

Part A — UI build-out (/web):
1. For every screen listed in UI/UX §6, implement the React component using the JSX references in ./jsx-mockups/ (webapp + mobile variants). Wire to the real API endpoints per UI/UX §6's route→endpoint mapping.
2. PWA: register service worker via vite-plugin-pwa, add manifest per UI/UX §9, install prompts on mobile.
3. Auth wiring: login screen, magic-link accept screen, refresh-token rotation on 401, logout on refresh failure.
4. Role-based routing: students, faculty, finance, admin, superadmin each land on their dashboard per PRD §4. Superadmin UI is read-only (disable all write controls visually + backend enforces anyway).
5. Responsive breakpoints per UI/UX §5. Tailwind config uses the brand palette tokens from UI/UX §2. Poppins font self-hosted (not Google Fonts CDN — DPDP-friendly).
6. Accessibility: pass axe-core on every route, keyboard nav everywhere, focus trap on modals.
7. Empty states + error boundaries on every screen.

Part B — Deployment:
1. Generate render.yaml per Deployment Runbook §3 (api + web + cron).
2. Build ./scripts/sign-job-jwt.ts exactly as specified in Deployment Runbook §5.
3. Wire Sentry + BetterStack per Runbook §7 (env-driven; no-op when DSN absent).
4. Run the 24-step pre-launch smoke test (Runbook §8) against a staging deploy. Fix every finding. Do not declare M9 done until the list is green.
5. Write ./DEPLOY.md — the exact commands the operator runs to go live (based on Runbook §9 T-24h / T-2h / T-0 / T+1h / T+24h).

Tests:
- E2E happy path (Playwright): admin creates a student → student accepts invite → views course → takes a quiz → sees feedback → raises a ticket → pays a fee (finance records it) → gets a certificate. One test, one run, full flow.
- Lighthouse score ≥ 90 on all 4 metrics for student dashboard.

Report back with:
- The staging URL
- Screenshots of all major screens (admin dashboard, student dashboard, finance dashboard, faculty dashboard, course screen, fees screen, tickets screen, timetable screen)
- The Playwright E2E run result
- The pre-launch smoke test tick-list
- The DEPLOY.md
```

**DoD check for M9:**
- Staging URL reachable on real browser AND as installed PWA on phone.
- Every role can log in and use their dashboard.
- Lighthouse ≥ 90.
- Playwright E2E passes.
- Pre-launch smoke test all green.

---

## Standing prompts — use any time during the build

### Debug prompt (when something breaks)

```
Stop implementing. A bug is blocking M{N}. Here is the failure:

<paste error + stack + reproduction steps>

Before proposing a fix:
1. Re-read the TRD section(s) that govern this code path.
2. Check whether this is a spec gap or a code bug.
3. If spec gap: flag it and ask me. Do not invent.
4. If code bug: write a failing test first that reproduces it, then fix, then confirm test passes.

Do not change scope. Do not refactor unrelated files.
```

### Spec-check prompt (when unsure)

```
I'm about to implement <feature>. Before I write code, summarise what the doc pack says about it, in this format:

- BRD says: ...
- PRD says: ...
- TRD says: ...
- UI/UX says: ...
- Contradictions I see: ...
- Ambiguities I need clarified: ...

Wait for my confirmation before coding.
```

### Integration-swap prompt (when moving from stub to live)

```
Swap the <Cloudinary|Resend|SendGrid|WhatsApp|Certifier> integration from stub to live.

Required:
1. The adapter interface in packages/shared-types/integrations.ts must NOT change.
2. The live implementation goes in /api/src/integrations/<name>/<name>Adapter.ts.
3. All secrets from env vars — no hard-coded keys.
4. On boot, validate credentials with a lightweight "ping" call; fail fast with a clear log line if bad.
5. Add a feature flag INTEGRATIONS_<NAME>_MODE=stub|live (default stub in dev/test, live in prod).
6. Add one integration test that runs against the live service behind a CI_LIVE_INTEGRATIONS=true gate (skipped by default).
7. Update Deployment Runbook §6 (env vars) if any new var is added.

Show me the diff before committing.
```

### Release-cut prompt

```
Cut release v{X.Y.Z}. Steps:
1. Run full test suite + Playwright E2E. Block if any red.
2. Update CHANGELOG.md under "## [X.Y.Z] — {date}".
3. Tag: git tag vX.Y.Z -m "<summary>".
4. Merge to main, push tag.
5. Trigger Render deploy for api + web.
6. Run the post-deploy smoke subset from Runbook §8 items 14-24.
7. Announce in the #india-learns-releases channel template (draft text only — don't send).

Report the tag SHA and deploy URL.
```

### Rollback prompt

```
Rollback to tag v{X.Y.Z}. Follow Deployment Runbook §10 exactly:
1. Render dashboard → api service → Manual Deploy → pick the v{X.Y.Z} commit.
2. Same for web.
3. MongoDB: if schema migration ran since v{X.Y.Z}, restore from point-in-time backup per Runbook §7. Else no DB change.
4. Post rollback: run Runbook §8 items 1, 5, 9, 14 to sanity-check.
5. Report time-to-rollback. Target ≤ 30 min (BR-14).

Do NOT run a forward-fix first. Rollback first, diagnose after.
```

---

## Notes on using these prompts

- **One milestone = one long session.** Don't try to cram M5 into a chat that already built M1–M4. Restart the session at the top of each milestone so Claude Code re-reads the docs cleanly.
- **Commit at every DoD tick.** If M3 passes DoD, commit. Don't let 3 milestones of work sit uncommitted.
- **Read the audit log.** Every staff write goes through AuditLog. If something looks wrong, check the log — it's the fastest debugger in the app.
- **Don't silence tests.** If a test flakes, find the race condition. The test suite is your contract with the spec.
- **PENDING items** (logo SVG, GST number, registered address, Finance operator name, domain DNS) will block Prompt 8 Part B. Chase Logan for these no later than end of M6.
