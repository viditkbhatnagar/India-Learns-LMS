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
- [ ] Admin screens: create/edit/suspend student; create/edit faculty; finance staff (deferred — surfaces this API, but the UI ships alongside M3 when the web client lands)

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
- [ ] M3 web client (deferred with M2 admin screens — ships alongside M4 UI per TASKS M2 backlog)

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
- [ ] M4 web client (deferred with M2/M3 UI backlog per TASKS M3 note)

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
- [ ] M5 web client (deferred with M2/M3/M4 UI backlog; Finance + student fees screens map 1:1 to the API contract per plan research)

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
- [ ] Admin ticket dashboard UI (deferred with M2/M3/M4/M5 UI backlog; API contract ready)

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
- [ ] Faculty + student M7 UI screens (deferred with M2/M3/M4/M5/M6 UI backlog; API contract ready, approved webapp mockups in-place)

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
- [ ] Quiz/exam attempt screens (deferred to M9 UI polish — API contract ready)
- [ ] Deep admin CRUD: Batches, Timetable builder, Enrollment detail with "Issue Certificate", Audit-log browser (deferred to M9 polish)
- [ ] Finance payments list + reverse + CSV reports UI (deferred to M9 polish)
- [ ] Faculty grading + feedback editor (deferred to M9 polish)

## M9 — Polish + deploy (day 39–42)

- [ ] render.yaml (api + web + cron) with fee-reminders / sla-timers / autosuspend / digest-faculty-weekly / notifications-retry schedules
- [ ] scripts/sign-job-jwt.ts (Runbook §5)
- [ ] Sentry + BetterStack (env-driven, no-op when DSN absent)
- [ ] Deploy M2–M8 UI backlog polish: quiz/exam attempt, deep CRUD, finance payments list + reverse, faculty grading, admin analytics CSV download buttons
- [ ] PWA: full workbox runtimeCaching, offline fallback route, install-prompt component, self-host Poppins
- [ ] Accessibility: WCAG 2.1 AA pass + axe-core sweep on every route + keyboard nav + focus trap on modals
- [ ] Add `/healthz` + `/readyz` per TRD §14
- [ ] 24-step Pre-launch smoke checklist (Runbook §8) against staging
- [ ] Playwright E2E: admin creates student → accepts invite → views course → takes a quiz → sees feedback → raises ticket → pays fee → gets certificate (single run)
- [ ] Lighthouse ≥ 90 on all 4 metrics for student dashboard
- [ ] Logo SVG integration (Q-PENDING-01) + receipt branding
- [ ] Meta WABA templates live + Resend/SendGrid live swap + Certifier.io live key
- [ ] DEPLOY.md operator runbook
- [ ] 3-day UX pass — copy/spacing/empty-state fixes only
