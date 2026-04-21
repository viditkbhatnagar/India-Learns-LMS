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

## M8 — Certificates + notifications + analytics (day 34–38)

- [ ] Course completion detection + Certifier.io issue flow
- [ ] Email + WhatsApp notification engine (template registry)
- [ ] Admin analytics dashboard (counts, enrolment stats, SLA breaches, API cost tracking)

## M9 — Polish + deploy (day 39–42)

- [ ] PWA manifest + service worker + offline fallback
- [ ] Add `/healthz` + `/readyz` per TRD §14
- [ ] Render deployment per runbook
- [ ] Smoke-test checklist passing
- [ ] 3-day UX pass — copy/spacing/empty-state fixes only
