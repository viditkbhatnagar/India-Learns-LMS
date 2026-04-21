# M8 — Certificates + Notifications + Analytics (+ M2–M8 web UI)

**Dates:** 2026-04-22
**Spec refs:** TRD §4.10, §5.10–§5.12, §6, §9.2, §9.4, §10; PRD §13, §14, §15; BRD BR-10, BR-13.
**Commits:**
- `feat(m8-backend): certificates + notifications engine + analytics + retry cron` — backend + tests + smoke
- `feat(m8-web): port M2–M8 screens` (this session) — web UI build-out

## What was built

### Backend (Part A)

1. **CertificateAdapter interface** ([packages/shared-types/src/integrations.ts](../../packages/shared-types/src/integrations.ts)) per TRD §9.4 exactly: `issue({studentName, email, courseName, completionDate, templateId, idempotencyKey}) → {certificateUrl, providerId}`.
2. **Adapter impls** ([api/src/integrations/certificateAdapter.ts](../../api/src/integrations/certificateAdapter.ts)):
   - `ConsoleCertificateAdapter` — deterministic stub URL via sha1(enrollmentId) so tests assert round-trip without network.
   - `CertifierIoAdapter` — POST to `https://api.certifier.io/v1/credentials` with Bearer auth, Idempotency-Key header, 10s timeout, throws `INTEGRATION_FAILED` on non-2xx.
   - Wired into factory: stub mode or `CERTIFIER_ENABLED=false` → Console, else CertifierIo.
3. **certificateService** ([api/src/services/certificateService.ts](../../api/src/services/certificateService.ts)):
   - `issueForEnrollment({enrollmentId, actor})` — idempotent; returns existing URL when re-called. Persists `certificateUrl`, `certificateProviderId`, `certificateIssuedAt`, clears `certificateIssueError`. On failure: persists error, audits `certificate.issue_failed`, throws 502.
   - Listener on `course.completed` (single-flight via `registerCertificateListener`) auto-issues.
   - `listCertificatesForStudent`, `countIssuedCertificatesForStudent`.
4. **Models extended**:
   - `Enrollment` — added `certificateProviderId`, `certificateIssueError`.
   - `Notification` — added `retryCount`, `lastRetryAt`, plus `certificate.issued` enum entry and retry-sweep index.
   - `Course.certificateTemplateId` confirmed (already present from M3).
   - `DomainEvent` — `certificate.issued` enum entry + LISTENERS registry slot.
5. **NotificationPrefs model + service** ([api/src/models/notificationPrefs.ts](../../api/src/models/notificationPrefs.ts), [api/src/services/notificationPrefsService.ts](../../api/src/services/notificationPrefsService.ts)):
   - Per-user sparse maps `emailByType` + `whatsappByType` (D-073 Mixed type).
   - Defaults: email on for every type; WhatsApp on only for the 3 approved template types.
   - `updatePrefsForUser` rejects WhatsApp=true on non-templated types with `422 VALIDATION_FAILED`.
6. **ApiCostLedger** ([api/src/models/apiCostLedger.ts](../../api/src/models/apiCostLedger.ts) + [api/src/services/apiCostService.ts](../../api/src/services/apiCostService.ts)) — D-070.
7. **NotificationService extensions**:
   - `certificate.issued` added to `CHANNELS_BY_TYPE` as `['inapp', 'email']` (no WhatsApp — not in allowlist D-007).
   - Per-user prefs enforcement loads `NotificationPrefs` before each dispatch and filters channels per recipient.
   - `sendEmailWithFallback` wrapper — tries primary, catches, falls back to secondary (SendGrid), writes cost-ledger rows for each leg.
   - Cost-ledger hooks on every successful adapter call.
   - `retryFailedNotifications({now, maxAttempts, windowHours})` — exponential backoff sweep, idempotent, capped at `NOTIFICATIONS_RETRY_MAX=3`.
   - `typeSupportsWhatsApp(type)` helper.
8. **Analytics** ([api/src/services/analyticsService.ts](../../api/src/services/analyticsService.ts) + [api/src/routes/analytics.ts](../../api/src/routes/analytics.ts)):
   - `GET /v1/analytics/summary` — all 7 PRD §15 widgets (students, admissions, fees, assessments, sla-breaches, feedback, api-cost) + 14-day sparklines (students, fees collected, sla breaches) in one call. 5-min TTL in-memory cache.
   - `GET /v1/analytics/collections?from=&to=` — Payments grouped by day + mode + component.
   - `GET /v1/analytics/sla-breaches?week=YYYY-Www` — Ticket breaches grouped by category, ISO-week-scoped.
   - All routes `requireRole('admin','superadmin')`. Finance/faculty scoped subsets deferred to M9.
9. **Retry cron endpoint** ([api/src/routes/jobsNotifications.ts](../../api/src/routes/jobsNotifications.ts) + [api/src/jobs/notificationsRetryJob.ts](../../api/src/jobs/notificationsRetryJob.ts)): `POST /v1/jobs/notifications-retry` with `requireJobAuth` (HMAC). Render cron schedule `*/15 * * * *` pending `render.yaml` in M9.
10. **Student dashboard** — real `certificates` and `unreadNotifications` buckets (no more stubs).
11. **TRD §5.11 aliases**:
    - `GET /v1/me/notifications` + `POST /v1/me/notifications/:id/read` — new alias router alongside existing `/v1/notifications/me` (D-072 dual-mount pattern).
    - `GET/PATCH /v1/me/notification-prefs` — new.
12. **Auth whitelist** — fees-suspended students can still read `/me/notifications`, `/me/notification-prefs`, `/me/certificates` so they can understand + act on the suspension.
13. **Seed extended**:
    - Marks seeded enrolment `completed=true` + invokes `issueForEnrollment` via the listener so a stub certificate exists post-seed.
    - `NotificationPrefs` row per seeded user.
    - 7 `ApiCostLedger` rows (email/whatsapp/storage/certifier sample) for non-zero dashboard demo.

### Web (Part B–D)

Workspace `/web/src/`:
- **Deps added**: axios, @tanstack/react-query, zustand (persist), date-fns + date-fns-tz, recharts, clsx, react-hook-form.
- **Infra**: [lib/api.ts](../../web/src/lib/api.ts) axios client with 401→refresh interceptor; [store/auth.ts](../../web/src/store/auth.ts) zustand persist store; [lib/endpoints.ts](../../web/src/lib/endpoints.ts) typed per-domain wrappers over all M2–M8 routes; [lib/format.ts](../../web/src/lib/format.ts) INR + IST helpers.
- **UI primitives**: [components/ui/](../../web/src/components/ui/) — Button, Card, Input/TextArea, Badge, Skeleton, EmptyState, ErrorAlert, ErrorBoundary.
- **Shell + guards**: [components/AppShell.tsx](../../web/src/components/AppShell.tsx) sidebar + top bar + mobile drawer; [components/NotificationBell.tsx](../../web/src/components/NotificationBell.tsx) polling every 30s; [components/guards.tsx](../../web/src/components/guards.tsx) `RequireAuth` + `RequireRole` with role-based landing redirects.
- **Pages** (role-grouped):
  - Auth: LoginPage, ForgotPasswordPage, ResetPasswordPage, AcceptInvitePage.
  - Student: StudentDashboard (live tiles inc. certs + unread), StudentCourses + CourseDetail + ModuleView (video/PDF/text), StudentTimetable (week picker), StudentFees (installments + receipt downloads), StudentTickets + NewTicket + TicketDetail (thread + reopen-request button if within 7 days), StudentFeedback, StudentCertificates (view / download), Profile + NotificationPrefsPage (full toggle matrix per event + WhatsApp allowlist gating).
  - Admin: AdminDashboard (analytics summary with recharts sparklines + SLA breach panel + API spend), AdminUsers (search + filter), AdminInviteUser, AdminUserDetail (suspend/unsuspend/resend-invite), AdminTickets (SLA-breach counter + filter), AdminPrograms (list + create), AdminCourses (list). Placeholders for Batches/Timetable-builder/Enrollments/Audit-logs/Ticket-detail — live API ready; deeper CRUD deferred to M9.
  - Finance: FinanceDashboard, FinancePaymentNew (search student → confirm balance → record payment with method/reference/notes).
  - Faculty: FacultyDashboard (own courses + this-week timetable).
  - Superadmin: shares admin screens; top-bar shows "Read-only" badge; write buttons hidden on user detail. Backend still enforces.
- **PWA**: `vite-plugin-pwa` manifest retained (brand name, orange theme, cream background). Full workbox/offline route list + install prompts deferred to M9.

## Tests passing

- 401 tests across 78 test files (was 364 / 69 — **+37 new M8 tests**, 0 regressions).
- Services coverage: 82.52% lines / 65.95% branches / 92.02% functions (gates 70/55/70 ✅).
- New test files:
  - `api/tests/unit/certificateService.test.ts` — idempotency, listener single-flight, error persistence, audit writes, cost ledger increment.
  - `api/tests/unit/notificationPrefsService.test.ts` — defaults + WhatsApp allowlist rejection + prefs enforcement suppresses email.
  - `api/tests/unit/notificationRetry.test.ts` — exponential backoff, skip-within-window, max-attempts cap.
  - `api/tests/unit/analyticsService.test.ts` — TTL cache, student counts, cost aggregation, ISO week parsing, SLA breach grouping.
  - `api/tests/integration/certificates.test.ts` — POST issue 201 / 200 reissued / 403 non-admin / 409 not-completed; GET /me/certificates.
  - `api/tests/integration/notificationPrefs.test.ts` — defaults, PATCH persist, WhatsApp allowlist 422, unknown-type 422, TRD alias round-trip.
  - `api/tests/integration/analytics.test.ts` — summary shape, 403 for student/faculty/finance, superadmin allowed, collections & sla-breaches happy path + malformed-week 422.
  - `api/tests/integration/jobs.notificationsRetry.test.ts` — 401 unsigned, 200 signed + retry result.

## Files changed

See commit diff. 42 backend files (22 new / 20 modified) + ~30 web files (new).

## Open items / follow-ups

- **Q-M8-01**: Reconcile cost rates against real Certifier.io/Resend/WABA invoices. Current defaults: Email 50p, WhatsApp 200p, Storage 5p, Certifier 2500p.
- **Q-M8-02**: Logo SVG (Q-PENDING-01 from M1) still blocks the PWA icon set + certificate header.
- **Q-M8-03**: Certifier.io API key (Q-PENDING-08 from M7) still blocks live cert smoke.
- **Q-M8-04**: Finance + faculty scoped analytics tiles (SLA-for-my-courses, collections-only for finance) — deferred to M9.
- **M9 handoff**:
  - Quiz/exam attempt screens + faculty grading UI + rubric editor.
  - Deep admin CRUD: Batches, Timetable builder (with overrides + holidays), Enrollments (inc. "Issue certificate" button wired to POST endpoint), Audit-log browser.
  - Finance payments list + 24h reverse button + CSV reports.
  - render.yaml with fee-reminders/sla-timers/autosuspend/digest-faculty-weekly/notifications-retry crons, `scripts/sign-job-jwt.ts`, DEPLOY.md.
  - Sentry + BetterStack wiring.
  - Playwright E2E covering the full admin→student flow.
  - Lighthouse ≥ 90 + WCAG 2.1 AA pass.
  - Meta WABA templates + Resend/SendGrid live swap.
  - Real logo SVG integration + receipt branding.

## Decisions committed

D-069 · D-070 · D-071 · D-072 · D-073 · D-074 · D-075 (see [../decisions.md](../decisions.md)).
