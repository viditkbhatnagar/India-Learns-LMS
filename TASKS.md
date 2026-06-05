# TASKS — India Learns LMS

Live task list. Update at every session start (mark new) and every session end (mark done). Source of milestone breakdown: [`claude-code-docs/CLAUDE.md` §4](claude-code-docs/CLAUDE.md).

---

## M1 — Foundations (day 1–3) — DONE 2026-04-21

- [x] Repo bootstrap — monorepo with `/api`, `/web`, `/packages/shared-types`
- [x] Memory directory + `TASKS.md` per CLAUDE.md §10
- [x] Root tooling: TS 5.4, ESLint 9 (airbnb-base via FlatCompat) + Prettier, .editorconfig, .nvmrc
- [x] `/api` skeleton: Express 4 + Mongoose 8 + pino + helmet + zod + vitest + supertest + mongodb-memory-server
- [x] `/web` skeleton: React 18 + Vite 5 + Tailwind 3 + vite-plugin-pwa + React Router 6
- [x] `/packages/shared-types` placeholder (proves workspace link graph)
- [x] `.env.example` per package (full TRD §12 list)
- [x] GitHub Actions CI: lint + typecheck + test + build on push
- [x] `GET /health` returns `{ ok: true, commit, uptimeSec, ts }`
- [x] Vite "Hello India Learns" landing page with brand palette
- [x] `npm install` + `npm run dev` work end-to-end locally
- [x] Initial commit + push to `https://github.com/viditkbhatnagar/India-Learns-LMS.git`
- [x] CI green — https://github.com/viditkbhatnagar/India-Learns-LMS/actions/runs/24719414240
- [x] Session-end memory checkpoint (`memory/milestones/M1-foundations.md` + `chore(memory): checkpoint after M1`)

## M2 — Auth + user management (day 4–7) — BACKEND DONE 2026-04-21

- [x] Magic-link invite flow, password set, login, refresh, logout (server-only; curl DoD ✔)
- [x] Audit log collection + `recordAudit` helper (every staff write + login attempts)
- [x] Role model (Admin, Superadmin, Finance, Faculty, Student) + `requireAuth` + `requireRole(...)` middleware
- [x] Integration adapter interfaces + Console* stubs (Resend/SendGrid/Meta WABA deferred to their own milestones)
- [x] `seed:superadmin` npm script + env hooks
- [x] Vitest + mongodb-memory-server harness; 48 tests green; services coverage 89% lines
- [x] Admin screens: create/edit/suspend student; create/edit faculty — shipped (AdminUsers + AdminUserDetail). Finance role removed entirely in PR-R; admin handles all finance work.

## M3 — Course + enrollment core (day 8–12) — BACKEND DONE 2026-04-21

- [x] Program, Course, Module, Batch, Enrollment models (+ indexes + state enums per TRD §4.2–4.4)
- [x] Admin CRUD for programs/courses/modules/batches; sandbox↔published on Course (`publishedVersion` increments, no rollback per D-030)
- [x] Enrollment collection with validity dates (`validFrom/validTo`), lifecycle `status` + M5-ready `accessState` (D-026)
- [x] `POST /v1/enrollments` creates N rows (one per program course); `BATCH_FULL` + `ENROLLMENT_DUPLICATE` guards
- [x] `GET /v1/enrollments/me` + `/v1/me/courses` alias (D-031); `/v1/me/courses/:courseId` for course detail
- [x] `GET /v1/students/me/dashboard` with M4–M7 stub buckets
- [x] Faculty gated via `Course.facultyIds` (D-024) — content-only PATCH on modules, 403 on structural fields/delete
- [x] Student module-access gate (`assertStudentCanViewModule`) — 6 steps + `module.viewed` audit (D-029)
- [x] `StorageAdapter` interface + `ConsoleStorageAdapter` + `CloudinaryStorageAdapter` class stub; factory honours `INTEGRATIONS_MODE` / `STORAGE_PROVIDER` (D-027)
- [x] `POST /v1/storage/upload-url` — admin or faculty-on-assigned-course
- [x] Seed script `npm run seed -w api` — Aviation + Retail & Fashion Diploma, idempotent (D-033)
- [x] 24 test files / 115 tests green; services coverage 81.89% lines (exceeds 70% gate)
- [x] Session-end memory checkpoint (D-024 … D-034 + Q-M3-01/02/03 + M3 milestone file)
- [x] M3 web client — shipped over M8 + M10 (Programs / Courses / Modules / Batches / Enrolments admin pages, Student dashboard, Faculty dashboard)

## M4 — Timetable (day 13–15) — BACKEND DONE 2026-04-21

- [x] TimetableEntry / TimetableOverride / Holiday / Notification models
- [x] Admin CRUD: `/v1/batches/:id/timetable`, `/v1/timetable/:entryId`, `/v1/timetable/overrides`, `/v1/holidays`
- [x] Resolver `/v1/timetable?batchId=&from=&to=` with IST wall-clock ISO (+05:30) occurrence DTOs
- [x] `/v1/me/timetable?week=YYYY-Www | from=&to=` (student + faculty), faculty auto-filtered
- [x] Overlap validation (same-batch OR same-faculty OR same-non-empty-room) → `TIMETABLE_OVERLAP`
- [x] NotificationService (in-app + email; NO WhatsApp — D-037/BRD §6.1) + `/v1/notifications/me`, `/:id/read`
- [x] `getNextClassForStudent` — populates `StudentDashboardDto.nextClass.value`
- [x] IST helpers via `date-fns-tz` (finally installed per D-040)
- [x] Seed extended: Aviation Batch 1 + 2 entries + 1 reschedule override + 15 Aug holiday (D-042)
- [x] 166 tests green (35 files, +11 new) · services coverage 81.3% lines / 93.16% functions / 64.15% branches
- [x] `docs/smoke/m4-timetable.md` + memory checkpoint (D-036…D-042, Q-M4-01…05)
- [x] M4 web client — shipped (Timetable builder, holidays, weekly view, faculty/student timetable pages)

## M5 — Fees + suspension (day 16–22) — BACKEND DONE 2026-04-21

- [x] FeeStructure, Invoice, FeeInstallment, Payment, Receipt, CreditNote models (D-043)
- [x] FeeStructure CRUD + admin-only POST/PATCH, finance + admin GET
- [x] `POST /v1/enrollments/:id/generate-fees` idempotent invoice generation with dueRuleResolver
- [x] `POST /v1/payments` with auto-allocation (oldest-first) + explicit allocations + overpayment → CreditNote
- [x] `POST /v1/payments/:id/reverse` within 24h window (D-044) → CreditNote
- [x] Receipt PDF via pdfkit with Indian-locale amount-in-words + FY-scoped RCP code (D-051)
- [x] CloudinaryStorageAdapter wired live + ConsoleStorageAdapter byte cache for stub mode (D-048)
- [x] `GET /v1/receipts/:id/download` streams PDF (stub) or returns Cloudinary signed URL (live)
- [x] `GET /v1/students/:id/fees` + `/v1/students/me/fees` alias with access-state aggregate
- [x] `outstandingFees` bucket on `StudentDashboardDto` populated (real)
- [x] NotificationService extended: 8 `fees.*` types, `whatsapp` channel + gating + 2 WABA template mapping (D-049)
- [x] Fee reminder cron service — 7 fire points × idempotent `$addToSet` (T-14, T-7, T0, T+3, T+14 warn1, T+21 warn2, T+28 suspend)
- [x] `clockService.nowUtc()` + test-injection (D-047)
- [x] suspensionService with 5-state machine (active/warn1/warn2/override/suspended) + auto-reconcile on payment
- [x] `POST /v1/users/:id/suspension/override` (+ DELETE) on User (D-045)
- [x] Fees-suspension route whitelist inside `requireAuth` (D-050)
- [x] `requireJobAuth` HMAC + 5-min replay guard (D-046)
- [x] `POST /v1/jobs/fee-reminders`, `POST /v1/jobs/autosuspend` cron endpoints
- [x] Seed extended: finance user + FeeStructure + sample student + invoices + sample payment
- [x] 83 new tests (48 files / 249 tests total) · services coverage 83.56% lines
- [x] `docs/smoke/m5-fees.md`
- [x] Memory checkpoint (D-043 … D-051 + Q-M5-01…06 + M5 milestone file)
- [x] M5 web client — shipped (Finance dashboard + record payment + payment detail + student fees view + manual installments PR-S)

## M6 — Tickets (day 23–28) — BACKEND DONE 2026-04-22

- [x] Ticket + TicketComment models (D-053/D-059); Notification enum +6 types; AUDIT_ACTIONS +9
- [x] `businessDayService` (Mon–Fri + Holiday-aware) built on M4 Holiday model (D-054)
- [x] `counterService.nextTicketCode` per-category yearly counter (`TKT-ACAD/ADMIN/FIN/TECH/CMPL-NNNNNN`)
- [x] `ticketRoutingService` — academic→course faculty/coord, admin→deptTag(ops|it) fallback any admin, finance→finance pool, complaints→superadmin pool (D-056)
- [x] `ticketService.createTicket` — complaint precondition (D-008), SLA deadline compute (5d / 15 bd), routing + assignment, audit + notification
- [x] `transitionTicket` with state-matrix validation + `TICKET_STATE_INVALID` (illegal) and `REOPEN_WINDOW_EXPIRED` (7-day cliff, D-057)
- [x] `reopenTicket` (staff) + `requestReopen` (student → child ticket with `parentTicketId`, D-058)
- [x] `addComment` — student forced public, first staff public comment flips `firstAckAt` + `open → assigned`
- [x] `listForStudent` / `listForStaff` / `listForAdmin` / `getTicketDetail` with ACL + visibility filter
- [x] `slaService.computeBreaches` — idempotent atomic flip of `slaAckBreached`/`slaResolveBreached` (D-055); notify assignee + admin pool
- [x] Routes: `/v1/tickets` (CRUD), `/v1/me/tickets` + `/v1/tickets/me` alias (D-059), `/v1/staff/tickets`, `/v1/jobs/sla-timers` (HMAC)
- [x] POST + PATCH aliases on `/:id/state` (D-059)
- [x] `notificationService` extended: 6 new `ticket.*` channel maps; `il_ticket_update` WABA template wired for `ticket.state_changed` only
- [x] `auth.ts` fees-suspension whitelist casing fix + GET tickets + POST finance tickets + reopen-request (D-052)
- [x] `api/src/jobs/ticketSlaJob.ts` cron wrapper
- [x] Seed extended: academic-in-progress + academic-closed (reopen demo) + finance (fees-suspension demo)
- [x] 67 new tests (59 files / 316 total) · services coverage 84.5% lines / 66.81% branches / 94.8% functions (gates 70/55/70 — all pass)
- [x] `docs/smoke/m6-tickets.md`
- [x] Memory checkpoint (D-052 … D-059, Q-M6-01…04, M6 milestone file)
- [x] Admin ticket dashboard UI — shipped (AdminTickets, AdminTicketDetail, AdminSlaBreaches)

## M7 — Assessments + feedback (day 29–33) — BACKEND DONE 2026-04-22

- [x] Quiz + QuizAttempt + Exam + ExamAttempt + Rubric + FeedbackEntry + DomainEvent models
- [x] `assessmentScoring` — all-or-nothing MCQ (D-060); essay totals; blended percent
- [x] `quizService` (CRUD + start + submit; window + maxAttempts guards; student DTO strips correctIndices)
- [x] `examService` (CRUD + start + submit; essay pending manual grading; student DTO strips answer keys)
- [x] `gradingService.gradeExamAttempt` (faculty-own-course gate, rubric length validation, idempotent re-grade D-064, assessment.graded notification)
- [x] `rubricService` CRUD (numeric maxScore≥1, scale ≥2 labels)
- [x] `feedbackService` (draft/publish, published-cannot-revert D-065, level-shape guards, rubric coherence check, student read-only `/me/feedback`)
- [x] `courseCompletionService.checkAndMaybePublish` — all-quizzes-passed + exam-passed predicate (D-061), idempotent, publishes `course.completed`
- [x] `domainEventService` — persist + in-process listener registry (D-062), ready for M8 Certifier consumer
- [x] `facultyDigestService` — Mon 09:00 IST cron, 7-day threshold, ungraded essays + stale drafts bundle (D-063)
- [x] Routes: `/quizzes`, `/quiz-attempts`, `/exams`, `/exam-attempts`, `/rubrics`, `/feedback`, `/me/feedback` (mount order D-066); HMAC-signed `/jobs/digest-faculty-weekly`
- [x] Notification types +2 (`assessment.graded`, `feedback.published`), channels inapp+email, no WhatsApp (Q-M7-02)
- [x] 48 new tests (69 files / 364 total) · services coverage 81.05% lines / 65.59% branches / 90.35% functions (gates 70/55/70 — all pass)
- [x] `docs/smoke/m7-assessments.md`
- [x] Memory checkpoint (D-060 … D-067, Q-M7-01…05, M7 milestone file)
- [x] Faculty + student M7 UI screens — shipped (Faculty Grading queue, Feedback editor, Student Feedback, Student Quizzes / Exam attempt pages)

## M8 — Certificates + notifications + analytics (day 34–38) — BACKEND + UI BUILDOUT DONE 2026-04-22

- [x] CertificateAdapter interface + ConsoleCertificateAdapter + CertifierIoAdapter (live wire gated on CERTIFIER_ENABLED)
- [x] certificateService.issueForEnrollment — idempotent, listener auto-issues on course.completed, admin POST retry
- [x] Enrollment model: certificateProviderId + certificateIssueError fields
- [x] NotificationPrefs model + service with launch defaults + WhatsApp allowlist gating (D-073 Mixed type)
- [x] ApiCostLedger model + recordApiCost; EMAIL/WHATSAPP/STORAGE/CERTIFIER_UNIT_PAISE env-configurable (D-070)
- [x] notificationService extended: certificate.issued type + prefs enforcement + Resend→SendGrid fallback + cost hooks + retry sweep (D-069)
- [x] analyticsService.getAnalyticsSummary — 7 PRD §15 widgets + 14-day sparklines, 5-min TTL cache; getCollectionsReport; getSlaBreachReport
- [x] POST /v1/enrollments/:id/issue-certificate (admin); GET /v1/me/certificates (student)
- [x] GET /v1/me/notifications + POST /v1/me/notifications/:id/read (TRD §5.11 aliases — D-072); GET/PATCH /v1/me/notification-prefs
- [x] GET /v1/analytics/{summary,collections,sla-breaches} (admin/superadmin)
- [x] POST /v1/jobs/notifications-retry (HMAC-signed, every 15 min) + notificationsRetryJob
- [x] Student dashboard: real certificates + unreadNotifications buckets (no more stubs)
- [x] Auth whitelist: /me/notifications, /me/notification-prefs, /me/certificates accessible under fees-suspended state
- [x] Seed extended: completed enrolment + auto-issued certificate + prefs rows + cost ledger demo rows
- [x] 37 new tests (78 files / 401 tests total); services coverage 82.52% lines / 65.95% branches / 92.02% functions (all gates ✅)
- [x] docs/smoke/m8-certificates.md
- [x] `feat(m8-backend)` commit
- [x] **Web UI build-out** — M2–M8 screens ported into /web/src/ (D-074, D-075):
  - [x] Scaffolding: axios + react-query + zustand(persist) + recharts + clsx + react-hook-form + date-fns-tz
  - [x] UI primitives (Button/Card/Input/Badge/Skeleton/EmptyState/ErrorBoundary) + AppShell + NotificationBell + route guards
  - [x] Auth pages: Login, Forgot password, Reset password, Accept invite
  - [x] Student pages: Dashboard, Courses+Detail+ModuleView, Timetable (week picker), Fees, Tickets+New+Detail, Feedback, Certificates, Profile + NotificationPrefs
  - [x] Admin pages: Dashboard (analytics + sparklines), Users+Invite+Detail, Programs, Courses, Tickets (with SLA breach counter + filter); placeholders for Batches/Timetable-builder/Enrollments/Audit-logs (API-ready)
  - [x] Finance pages: Dashboard, Record payment (search student → confirm balance → record); payments list placeholder
  - [x] Faculty pages: Dashboard (own courses + this-week timetable); placeholders for grading/feedback-editor
  - [x] Superadmin: shares admin screens with top-bar Read-only badge; backend enforces the gate
  - [x] PWA manifest present (full workbox + offline routes remain M9)
  - [x] Lint + typecheck + Vite build green
- [x] Memory checkpoint (D-069 … D-075 + M8 milestone file + open-questions update)
- [x] Quiz/exam attempt screens — shipped
- [x] Deep admin CRUD — Batches / Timetable builder / Enrolment detail (with Issue Certificate) / Audit-log browser all live
- [x] Finance payments list + reverse + CSV reports UI — shipped under /finance/* (admin-gated)
- [x] Faculty grading + feedback editor — shipped (CourseGradebookTab + Feedback)

## M9 — Polish + deploy (day 39–42) — ARTIFACTS DONE 2026-04-22; STAGING DEPLOY: OPERATOR

- [x] render.yaml (api + web + cron) with fee-reminders / sla-timers / autosuspend / digest-faculty-weekly / notifications-retry schedules
- [x] scripts/sign-job-jwt.mjs (D-079 — HMAC, not JWT, despite filename; pure Node ESM so cron container needs no tsx)
- [x] Sentry server (`@sentry/node`, no-op when DSN absent) + Sentry web (`@sentry/react`, no-op when VITE_SENTRY_DSN absent) — D-077. BetterStack: not auto-provisioned (operator-owned account; documented in DEPLOY.md).
- [x] M2–M8 UI backlog polish: quiz/exam attempt (with timer + autosubmit), 22 staff screens (admin batches/timetable-builder/enrollments+detail/audit-logs/fee-structures/ticket-detail/sla-breaches/holidays, faculty courses/grading queue+detail/feedback list+new/timetable, finance students/student-detail/record-payment/payments list+detail/reports CSV)
- [x] PWA: workbox runtimeCaching (NetworkFirst /me/* JSON, CacheFirst Cloudinary media), offline fallback (HTML + SPA route), install-prompt component, self-host Poppins via `@fontsource/poppins`
- [x] Accessibility: skip-to-content link, FocusTrap + body-scroll-lock on mobile drawer, axe-core Playwright sweep across every authenticated route per role
- [x] /healthz alias mounted (D-078)
- [x] 24-step pre-launch smoke checklist shipped at [docs/smoke/m9-launch.md](docs/smoke/m9-launch.md) — operator runs against staging
- [x] Playwright happy-path: auth + role routing + student journey + axe sweep + screenshot capture (4 specs in [web/e2e/](web/e2e/))
- [x] Lighthouse runner script ([web/scripts/lighthouse.mjs](web/scripts/lighthouse.mjs)) — fails CI if any of perf/a11y/best-practices/seo < 90
- [x] Logo placeholder SVG ([web/public/brand/logo-placeholder.svg](web/public/brand/logo-placeholder.svg)); real logo blocked on Q-PENDING-01
- [x] Resend / SendGrid / Brevo email adapters wired live (D-076)
- [x] DEPLOY.md operator runbook (T-24h / T-2h / T-0 / T+1h / T+24h + secret list + rollback)
- [x] Mobile PWA layouts via Tailwind responsive + per-role bottom tabs (D-081)
- [x] Onboarding screens (5) — [web/src/pages/onboarding/](web/src/pages/onboarding/) — D-082
- [x] All 409 tests pass (78 files; +8 from email adapters + healthz). Lint + typecheck + build all clean.

### Post-launch hotfixes
- [x] 2026-05-14 — `/apply/signup` rendered generic "Request failed validation." banner (Logan); now surfaces field-level errors from `err.details.fieldErrors`. (D-089, [docs/smoke/apply-signup-errors.md](docs/smoke/apply-signup-errors.md))
- [ ] Apply the same `err.details.fieldErrors` → inline-error pattern to other public forms (login, password reset, magic-link claim) — single-banner regression hiding everywhere there's a Zod schema on a public POST.
- [x] 2026-05-31 — Slide "Replace deck (JSON)" corrupted the deck (a PowerPoint-as-JSON / wrong-shaped array was persisted verbatim, count jumped 3→13) then crashed the viewer with "Cannot read properties of undefined (reading 'title')" (Logan). Backend validates per-slide shape before saving; viewer renders corrupt/foreign decks gracefully instead of white-screening; client size cap aligned to the 1 MB server limit. (D-107, [docs/smoke/slides-replace.md](docs/smoke/slides-replace.md))
- [x] 2026-06-04 — **PPTX → rendered slides**: "Replace deck" now accepts a PowerPoint (.pptx) and parses it server-side into slides (zero-dep zlib ZIP reader), so faculty no longer hand-convert PPT→JSON. Hardened against zip-bomb/CPU abuse + per-user rate limit. (D-108, [docs/smoke/slides-replace.md](docs/smoke/slides-replace.md)) — closes the "Evaluate PPTX-to-in-app-slides" follow-up.
- [x] 2026-06-05 — Faculty can now **delete materials** from a session (two-click confirm, oversight-gated, sibling of the row link). Backend delete already existed; added the UI control + DELETE integration tests. (D-109) — Logan request.

### Operator-actionable post-merge (not blocking M9 close)
- [ ] Provision MongoDB Atlas M0 (ap-south-1) → set MONGODB_URI in Render
- [ ] Create Render workspace → import blueprint (render.yaml) → fill the two secret groups per DEPLOY.md
- [ ] Run `npm run seed:superadmin -w api` against staging
- [ ] Walk 24-step smoke at [docs/smoke/m9-launch.md](docs/smoke/m9-launch.md), file findings under `docs/smoke/findings/`
- [ ] Run Playwright + Lighthouse locally before deploy (`npm run test:e2e -w web`, `npm run lighthouse -w web`)
- [ ] DNS flip per DEPLOY.md T-0
- [ ] Once Q-PENDING-07 (Meta WABA) lands → flip `WHATSAPP_ENABLED=true` in Render
- [ ] Once Q-PENDING-08 (Certifier.io key) lands → flip `CERTIFIER_ENABLED=true`
- [ ] Generate raster PWA icons (sharp-cli) if Lighthouse PWA flags SVG-only — v1.1 polish
- [ ] Bundle-split web chunk (recharts + sentry are heaviest) — v1.1 polish

---

## M10 — Additional features from May 2026 requirements docs

**Inputs:** `LMS_Requirements.docx`, `LMS_Faculty_Features_Requirements_.docx`. Decisions documented in [memory/decisions.md](memory/decisions.md) D-090.

### Shipped (this session, 2026-05-20)
- [x] **PR #24 / m10a** — Indian-school doc types (SSLC / +2 / Degree / TC / Passport photo) + Faculty Dashboard quick-access tiles (D-091)
- [x] **PR #25 / m10b** — `User.dateOfBirth` + `personalAddress` + `emergencyContact` + `parentGuardian` + Student Profile screen sections
- [x] **PR #26 / m10c** — Reports module (Attendance / Batch / Assignment with XLSX export) — `/v1/reports/{kind}?format=json|xlsx`
- [x] **PR #27 / m10d** — Daily attendance auto-report cron — `il-cron-daily-attendance-report` at 18:30 IST
- [x] **PR #28 / m10f** — Placement / Jobs module — Company + JobPosting + JobApplication + `/admin/placement` + `/jobs` + per-student `resumeUrl` (D-092)
- [x] m10g — memory + TASKS sweep (this entry)
- [x] **PR #29 / m10h** — Admin academic-data edit surface on AdminUserDetail
- [x] **PR #30 / m10i** — PDF reports + parent-CC on fee reminders + new-job notifications
- [x] **PR #31 / m10j** — Announcements UI (admin/faculty broadcast + student feed)
- [x] **PR #32 / m10k** — Post-conversion student documents (admin upload + student view)
- [x] **PR #33 / m10l** — Interview scheduling fields + faculty dashboard click-through attendance
- [x] **PR #34 / m10e1** — Chat foundation (models + REST + polling + 1:1 UI)
- [x] **PR #35 / m10m** — Socket.IO real-time chat + group batch chats
- [x] **PR #36 / m10n** — Chat unread surfaced in NotificationBell
- [x] **PR #37 / m10o** — Per-batch attendance screen — 1-click dashboard target
- [x] **PR #38 / m10p** — Interview scheduling modal (replace window.prompt)
- [x] **PR #39 / m10q** — MongoDB GridFS file storage (D-094) — direct file upload via `/v1/files/upload`; resume / student-documents / chat-attachments all now upload through GridFS by default. No Cloudinary credentials needed.
- [x] **PR #40 / m10r** — Finance role removed; admin owns finance now (D-095). Faculty content perms expanded: assigned faculty can PATCH module title/order + DELETE modules + PATCH course `summary`. Sweep covers 60+ files: enum, routes, services, models, seeds, frontend, tests, memory.
- [x] **PR #41 / m10s** — Visitor Leads admin CRUD module (pre-application funnel, no OTP send); manual installment management (add/edit/waive on top of auto-gen); faculty can publish + unpublish courses on assigned courses; admin gets a notification when any student completes a course; Admin & Faculty User Guide docx generated to `docs/guides/`. (D-096)
- [x] **PR-U / m10u** — Staff attendance module (faculty self-mark + admin override + admin list/filter); `parentGuardian` fieldset on Apply Form step 3; field-level errors on Login / Reset / Accept-invite; sessions-held filter on attendance report; public visitor self-registration at `/visitor-register` (rate-limited per-IP); TASKS.md cleanup. (D-097)

### Deferred to follow-up session (D-093) — **NOW SHIPPED**
- [x] **PR-E — Internal Chat (real-time, full).** Shipped over four sub-PRs:
  - [x] PR-E1 — Models + REST + polling (Conversation, Membership, ChatMessage, ChatAttachment)
  - [x] PR-M — Socket.IO server + JWT socket auth + real-time delivery
  - [x] PR-E1 / PR-Q — Web UI (chat list, thread view, composer, file upload via GridFS)
  - [x] PR-N — Polish + notifications integration (chat unread in NotificationBell)

### M10 follow-ups (not blocking, low priority)
- [x] Direct resume file upload — shipped via PR-Q (M10q, GridFS)
- [x] PDF renderers for Reports module — shipped via PR-I (M10i)
- [x] Job-published notification — shipped via PR-I (M10i)
- [x] Interview scheduling fields (date/time/location) — shipped via PR-L + PR-P
- [ ] Course-scoped attendance / assignment report variants for faculty
- [ ] Sessions-held filter on attendance report
- [ ] One-time backfill job for existing students' personal details from their ApplicationDraft
- [x] Admin "edit student personal details" surface — shipped via PR-H
- [ ] Apply Form step-3 UI to capture `parentGuardian` during apply (DTO already accepts it)
- [ ] WhatsApp template for daily attendance report (parent channel) — needs WABA approval first
- [ ] Cloudinary CDN — switch from GridFS once LUC asks for a CDN (env flip only, no code change)
