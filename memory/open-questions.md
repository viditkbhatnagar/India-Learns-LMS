# Open questions — India Learns LMS

Anything blocked on Logan / Vidit / external input. Reference Q-numbers when raising with stakeholders.

---

## Q-M1-01 — Brand name: "India Learns" — **CLOSED 2026-04-22 (pre-launch, operator confirmed)**
**Closed:** 2026-04-22 — operator confirmed "India Learns" is the brand name; no "LearnHub" variant. Domain will be decided at migration time (initial Render deploy uses a `.onrender.com` subdomain). Also dropped all "LUC" references from user-facing copy in the same session (UI, program descriptions, seed data, receipts org name, footer copyright, meta description, onboarding pages). LUC references remain only in `claude-code-docs/**` (original spec pack, internal docs) and `memory/**` (team context).
**Raised:** 2026-04-21 (M1)
**Owner:** Logan
**Context:** `claude-code-docs/CLAUDE.md`, `01_BRD.md`, `03_TRD.md`, `04_UI_UX_Spec.md` all say "India Learns" with `app.indialearns.com`. Root `/CLAUDE.md` and `PROMPTS.md` (some sections) say "India LearnHub" with `app.indialearnhub.com`. M1 implementation uses "India Learns" per source-of-truth hierarchy. Need confirmation before M9 deploy + DNS purchase.
**Impact if wrong:** Trivial fix (UI copy + `<title>` + env defaults), but affects domain registration — must be locked before M8/M9.

## Q-PENDING-01 — Official India Learns logo — **CLOSED 2026-04-22 (pre-launch, operator provided)**
**Closed:** 2026-04-22 — operator provided `india-learns-logo.jpeg` at repo root. Copied to `web/public/brand/logo.jpg` and wired into AppShell header, LoginPage, and onboarding BrandHeader (replaces the old "IL" text badge). Used `sips` to resize to 192×192 + 512×512 PNGs at `web/public/icons/` (for PWA + Lighthouse) and 180×180 apple-touch-icon + 32×32 favicon. vite.config.ts manifest updated to point to PNG variants. Old placeholder SVGs deleted (`logo-placeholder.svg`, `icon-*.svg`, `favicon.svg`). Logo format is JPEG (raster) — if an SVG version arrives later, just drop it in and update the filenames.
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Logan / Rejin.
**Workaround:** Brand-color placeholder SVG generated from `#F58220` + `#1A3A8F`.

## Q-PENDING-02 — Registered office address + GSTIN for receipts
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Rejin (LUC entity legal info).
**Workaround:** `RECEIPT_ORG_ADDRESS=PENDING`, `RECEIPT_ORG_GSTIN=""` in `.env.example`. Receipts will print "PENDING" until set.

## Q-PENDING-03 — Domain DNS for `app.indialearns.com` + `api.indialearns.com`
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Rejin.
**Workaround:** Build assumes the domain; Render config will parameterise it in M9.

## Q-PENDING-04 — Finance operator (Logan Q12)
**Source:** BRD §4.
**Owner:** Logan.
**Workaround:** Finance role permissions + UI built without a named human. UAT delayed until owner is named.

## Q-PENDING-05 — Content manager (Logan Q12)
**Source:** BRD §4.
**Owner:** Logan.
**Workaround:** Course/module CRUD built; first content batch waits on owner.

## Q-PENDING-06 — IT/System admin
**Source:** BRD §4.
**Owner:** Logan / Rejin.
**Workaround:** Technical ticket queue routes to Admin role until IT admin is named.

## Q-PENDING-07 — Meta WABA template approval
**Source:** Root `/CLAUDE.md` §8, TRD §9.3.
**Owner:** LUC ops.
**Workaround:** `WhatsAppService.sendTemplate()` is a no-op logger in dev. Toggle via `WHATSAPP_ENABLED=true` once Meta approves the three templates.

## Q-PENDING-08 — Certifier.io API key
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Logan / Vidit.
**Workaround:** Stub adapter issues a fake URL in dev (`CERTIFIER_ENABLED=false`).

## Q-M2-01 — `deviceId` convention for login/refresh/invite-accept — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — implemented UUIDv4 in `localStorage['il:deviceId']` via [web/src/lib/deviceId.ts](../web/src/lib/deviceId.ts). Wired into `authApi.login` + `authApi.acceptInvite` + the refresh interceptor. Server continues to treat the value as opaque (just min(1) / max(128)) — no UUID format validation; it only exists for the RefreshToken audit trail. See D-085.
**Raised:** 2026-04-21 (M2)
**Owner:** Vidit (lock when M3 web client starts).
**Context:** Server accepts `deviceId` as a free-form non-empty string in the login/refresh/invite-accept bodies. Plan is UUIDv4 persisted in localStorage. Decision isn't yet enforced.
**Impact:** Low. When M3 lands, either enforce UUID-v4 format server-side or keep it opaque (server only uses it for the RefreshToken audit trail).

## Q-M2-02 — Password-reset audit email PII
**Raised:** 2026-04-21 (M2).
**Owner:** Logan (DPDP readiness sign-off).
**Context:** `auth.password_reset_requested` audit log stores the submitted email in plain text in `details.email` so debugging "who tried to reset" is easy. Audit log is admin-gated (M6 UI). If DPDP interpretation requires hashed emails in audit, swap to sha256.
**Impact:** Low; one-line change in `authService.requestPasswordReset`.

## Q-M2-04 — `__Host-il_rt` cookie Path spec drift — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — code keeps `Path=/` (security-positive: preserves the `__Host-` prefix's guarantees; all major browsers enforce this). TRD §7 wording drift remains — flagged for the next doc-pack revision pass. No code change needed; the decision is to keep current behaviour.
**Raised:** 2026-04-21 (M2 review).
**Owner:** Vidit (spec note) + Logan (if TRD amendment needed).
**Context:** TRD §7 specifies the refresh cookie as `__Host-il_rt` with `Path=/v1/auth/refresh`. RFC 6265bis (and Chrome/Firefox/Safari enforcement) requires `__Host-`-prefixed cookies to have `Path=/` and no `Domain` attribute — otherwise browsers silently drop the cookie. M2 keeps the prefix and widens Path to `/` (security-positive choice). Route-level auth middleware gates where the cookie is actually consumed. TRD wording should be amended in a future doc update.
**Impact:** None functionally — current implementation works in real browsers and preserves the `__Host-` guarantees. The TRD should be reconciled before M9 to avoid confusion.

## Q-M2-03 — Rate-limit store swap for multi-instance deploy — **DEFERRED 2026-04-22 → Phase 2**
**Decided:** 2026-04-22 — Phase 1 runs on Render with a single `il-api` instance (see render.yaml), so the in-memory store is correct. Revisit when scaling horizontally; `rate-limit-redis` swap is documented as a one-file change. No action needed for launch.
**Raised:** 2026-04-21 (M2).
**Owner:** Vidit (M9 deploy prep).
**Context:** `express-rate-limit` uses in-memory store. OK for single-instance dev; Render free-tier has one instance per service. Once we scale to 2+ instances (not Phase 1), need `rate-limit-redis` so counters aren't per-replica. Runbook note required.
**Impact:** None in Phase 1; revisit before scale-out.

## Q-M3-01 — Enrollment `courseVersion` pointer for unpublish rollback
**Raised:** 2026-04-21 (M3).
**Owner:** Logan (product call on whether unpublish rollback is in Phase 1 scope).
**Context:** PRD §6.3 says "Publish creates a new immutable `courseVersion` pointer on affected enrolments — unpublishing rolls back." TRD §4.4 Enrollment schema does not include a courseVersion field; no rollback user story exists yet. D-030 defers this: `Course.publishedVersion` increments on publish, but enrolments don't snapshot it. If Logan wants rollback in Phase 1, we'll add a `coursePublishedVersion: number` field on Enrollment + a rollback endpoint that pushes subsequent publishes' previous assets back.
**Impact:** Medium. No current feature depends on it, but admin-triggered unpublish currently loses the "which version did each student see" history.

## Q-M3-02 — Batch status state-machine transitions — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — Phase 1 keeps admin-driven transitions with no state-machine validation. Rationale: batches are small (30 students max), admin pool is small (≤5 in Phase 1), and recovery from an accidental `archived` is trivial. Revisit in Phase 2 if the admin pool grows or scope adds automation.
**Raised:** 2026-04-21 (M3).
**Owner:** Logan / Vidit (spec).
**Context:** TRD §4.3 defines `status: 'planned' | 'active' | 'completed' | 'archived'`, but neither PRD nor TRD specifies the transition rules (who flips, when, what's allowed). M3 admin PATCH accepts any status transition with no validation. Fine for Phase 1 (admins drive manually), but worth codifying before M8 analytics start grouping by batch status.
**Impact:** Low; admins could accidentally "archive" an active batch. Soft constraint; recoverable.

## Q-M3-03 — Module deletion policy when module.viewed events exist — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — decision: allow soft-delete even when `module.viewed` audit rows exist. Audit rows are preserved; the M6 audit UI handles the "target deleted" case by rendering the stale id. No data loss, full audit trail intact. No code change needed.
**Raised:** 2026-04-21 (M3).
**Owner:** Logan.
**Context:** Current implementation soft-deletes Module on `DELETE /v1/modules/:id`. AuditLog rows for `module.viewed` reference `targetId = module._id`, which now points at a tombstoned doc. M6 audit UI will need to handle "module deleted but audit rows remain". Also open: should we prevent deletion when there are view events, or allow and just mark? Plan's integration test for `9 delete with viewed audit rows` wasn't added because the behaviour isn't spec'd — we silently allow.
**Impact:** Low. M6 UI will resolve this; safe default today is "allow soft-delete, preserve audit rows."

## Q-M4-01 — TimetableOverride `action='add'` extends the TRD enum
**Raised:** 2026-04-21 (M4)
**Owner:** Logan (spec ratification).
**Context:** TRD §4.5 enumerates `action: 'cancel' | 'reschedule'`. The M4 prompt §3 explicitly requires **cancel, reschedule, add**. Shipped as an additive extension: `'add'` with `entryId: null` represents a one-off extra class (newCourseId + newFacultyId + new time required). Need Logan's sign-off on the spec amendment.
**Impact:** Medium. The behaviour is merged and tested; the TRD text just needs to catch up.

## Q-M4-02 — Faculty `/v1/me/timetable` filter rule — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — keep literal `facultyId === self` filter. Matches PRD US-TT-04 as written. Coordinator / multi-role visibility is Phase 2 and would need a new role model (`coordinator`) anyway. No code change.
**Raised:** 2026-04-21 (M4)
**Owner:** Logan (spec clarity).
**Context:** PRD §8.2 US-TT-04 says "As Faculty, I see only my own classes." M4 implements this by filtering resolved occurrences to `facultyId === self`. Works today — but a coordinator or multi-role user (future-proof) might want all-faculty-on-their-batches visibility.
**Impact:** Low. Current behaviour matches the literal PRD wording.

## Q-M4-03 — Notification retention policy
**Raised:** 2026-04-21 (M4)
**Owner:** Vidit (M9 runbook author).
**Context:** `Notification` docs accumulate per user per event with no TTL. In-app inbox UI (M8) will likely want pagination + archive; for now, `/v1/notifications/me?limit=50` is the only read path.
**Impact:** Low for Phase 1 scale (≤ 126 admissions Y1); revisit before scale-out. Likely: add a `retainUntil` Date + TTL index OR a cron that archives `readAt`-set docs older than 90 days.

## Q-M4-04 — Room-overlap detection scope — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — keep cross-batch room-overlap enforcement (the stricter reading). Physical rooms are a shared resource; cross-batch conflicts are a real scheduling failure, not a data-model artefact. Empty `room: ''` continues to never conflict. No code change.
**Raised:** 2026-04-21 (M4)
**Owner:** Logan.
**Context:** `assertNoOverlap` rejects same-room overlaps across **all batches** (room = physical resource). Empty `room: ''` never conflicts. PRD §8.3 AC says "No two timetable entries overlap for the same Batch, same Faculty, or same Room" — ambiguous whether "same Room" scoping is cross-batch. Current implementation is the stricter reading (cross-batch).
**Impact:** Low. If Logan wants per-batch room scoping, add `batchId` equality to the room branch of the $or.

## Q-M4-05 — Notification copy currently hardcoded
**Raised:** 2026-04-21 (M4)
**Owner:** Vidit (M8 template registry author).
**Context:** `notifyTimetableChange` renders its own title/body strings (e.g. "Timetable update: Airport Ground Ops rescheduled"). Copy should move into the M8 template registry so Logan/Rejin can edit without a code change. Currently English-only; i18n TBD.
**Impact:** Low. Copy works for Phase 1; templates harden in M8.

## Q-M5-01 — FeeStructure component `weights[]` field (uneven monthly split) — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — `weights=[40,30,30]` is the pre-launch default, shipped via [api/scripts/seed-demo.ts](../api/scripts/seed-demo.ts) on the Aviation FeeStructure (`monthly_x` / `monthlyCount=3`). Existing seed.ts leaves `weights: null` (= equal split) so the old fixture is unaffected. No schema change — the field was already in the model.
**Raised:** 2026-04-21 (M5)
**Owner:** Logan (product call).
**Context:** M5 prompt proposed 40/30/30 installment default; TRD §4.6 pins the component model (`cadence: 'monthly_x'`, `monthlyCount`) with an implicit equal split. D-043: shipped spec model + optional `weights: number[]` on each component (largest-remainder allocation when provided) so 40/30/30 is a one-PATCH away if Logan confirms the need. Currently `weights: null` everywhere.
**Impact:** Low. If confirmed, just populate weights on existing FeeStructure rows; no schema change.

## Q-M5-02 — Credit-note apply endpoint vs. auto-consumption
**Raised:** 2026-04-21 (M5)
**Owner:** Logan / Vidit.
**Context:** Spec (TRD §5.6) has `POST /v1/payments/:id/reverse` → CreditNote + `POST /v1/payments` over-payment → CreditNote. It does NOT have an endpoint to re-apply a CreditNote to a later installment. M5 currently leaves credit notes with `consumed=false` and does not automatically burn them on next payment. If Logan wants explicit "apply-credit" UX, we'll add `POST /v1/credit-notes/:id/apply { amountPaise?, installmentId? }` in M6 or M9.
**Impact:** Low for Phase 1 — finance can manually record a new payment referencing the credit note in `notes`.

## Q-M5-03 — Admin override default duration — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — no hard cap on override duration. Admin picks any future date. UI defaults the picker to `now + 30d` (matches PRD US-FEE-04 wording) but allows any value. Audit trail captures actor + reason. Service stays unchanged. Rationale: LUC ops needs flexibility for edge cases (payment-plan renegotiation, hardship grants); a hard cap would force awkward "re-override every 30d" workflows.
**Raised:** 2026-04-21 (M5)
**Owner:** Logan.
**Context:** PRD §9.5 US-FEE-04 says "override for 30 days". M5 endpoint `POST /v1/users/:id/suspension/override { until, reason }` accepts any future date — admin-driven. If product wants the 30-day duration as a hard cap (not just a UI default), the service needs an extra guard.
**Impact:** Low. Currently admins can set any future date; UI can default to now+30d when it ships.

## Q-M5-04 — Reversal window (24h) is implied, not spec-pinned — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — 24h reversal window confirmed. Matches Indian card-refund norms and keeps the finance workflow predictable. Beyond 24h, finance issues a credit note + records a new offsetting payment (the existing CreditNote pathway handles this). No code change.
**Raised:** 2026-04-21 (M5)
**Owner:** Logan.
**Context:** PRD §9.6 implies a 24-hour reversal window but doesn't pin it. M5 hard-codes 24h (`REVERSAL_WINDOW_MS` in paymentService). If Logan wants 48h (or "any time, audited"), single-constant change.
**Impact:** Low.

## Q-M5-05 — Auto-suspend cron respects weekends/holidays? — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — no weekend/holiday carve-out. Autosuspend cron fires daily at 03:30 IST including Saturdays/Sundays. Rationale: a student already had 2 warnings + 28 days notice; suspending on a Sunday is not hardship (they contact admin Monday if there's a dispute, and override is a single API call). Simpler cron = fewer bugs. No code change.
**Raised:** 2026-04-21 (M5)
**Owner:** Logan.
**Context:** TRD §10.1 schedules `autosuspend` daily at 03:30 IST with no weekend/holiday carve-out. M5 honours that — suspensions fire on a Sunday if a Saturday was T+28. Policy may prefer to hold suspension until next business day.
**Impact:** Low; day-of-suspend drift is ≤ 2 days.

## Q-M5-06 — Cloudinary live mode smoke test
**Raised:** 2026-04-21 (M5)
**Owner:** Vidit (needs a sandbox Cloudinary account).
**Context:** `CloudinaryStorageAdapter` is fully wired (upload via upload_stream, signedUrl via private_download_url). Dev/test continue to use `ConsoleStorageAdapter` per D-016/D-027. No end-to-end smoke against a real Cloudinary account yet.
**Impact:** Medium — must exercise before M9 deploy. Covered by Q-PENDING-09 (new).

## Q-PENDING-09 — Cloudinary credentials for live-mode smoke
**Raised:** 2026-04-21 (M5)
**Owner:** Rejin / LUC IT.
**Context:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are declared in env schema and expected at deploy time. Live-mode wiring is in place; M9 deploy needs to verify a real upload/signed-download round-trip.
**Impact:** Blocks real receipt URLs in production. Dev path (stub) continues to work for demo.

## Q-M6-01 — Admin `deptTag` assignment for ticket routing
**Raised:** 2026-04-22 (M6).
**Owner:** Logan / Rejin.
**Context:** PRD §10.1 routes administration tickets to `role:admin` with `deptTag='operations'` and technical tickets to `deptTag='it'`. The `User.deptTag` field exists (D-056) but seed ships a single admin with no deptTag. Routing falls back to "any admin" when the preferred bucket is empty — works, but loses the split. Before go-live, production should tag at least one ops admin and one IT admin.
**Impact:** Low. Fallback behaviour is benign; just loses routing specificity.

## Q-M6-02 — SLA breach manager CC semantics — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — "manager" = any active `role:admin` for Phase 1. With ≤5 admins, the noise is tolerable. Per-assignee mentor mapping is Phase 2 if the admin pool grows. No code change.
**Raised:** 2026-04-22 (M6).
**Owner:** Logan.
**Context:** PRD §10.4 says breach alerts cc "the assignee + their manager". No `managerId` field on User in Phase 1. M6 treats "manager" = any active `role:admin`. Works for ≤ 5 admins; at scale, admins would get a noisy inbox. Revisit if the admin pool grows or if Logan wants per-assignee mentor mapping.
**Impact:** Low. Currently 1 seeded admin so 1 CC.

## Q-M6-03 — WABA `il_ticket_update` template variable shape
**Raised:** 2026-04-22 (M6).
**Owner:** LUC ops / Logan.
**Context:** D-007 / TRD §9.3 specifies `il_ticket_update` template body as `"Hi {{1}}, your ticket {{2}} has a new update. Status: {{3}}. View: {{4}}"` — 4 variables in order `[name, ticketCode, status, url]`. M6 wires the dispatch path but `WHATSAPP_ENABLED=false` keeps it dormant in dev/test. Meta approval of the exact template text + variable order should be reconfirmed before enabling.
**Impact:** Medium. If the approved template differs, one `waTemplateVars` branch to update before launch.

## Q-M6-04 — SLA re-arm behaviour on reopened tickets — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — SLA breach stays sticky once flipped. Reopens don't reset `slaResolveDeadline` or clear `slaResolveBreached`. Rationale: SLA dashboards are reporting tools, not operational controls — historical accuracy > re-arming optics. Student-initiated reopens already go through a NEW child ticket (`parentTicketId` path, D-058) so that flow naturally gets a fresh SLA. No code change.
**Raised:** 2026-04-22 (M6).
**Owner:** Logan.
**Context:** PRD §10 is silent on whether reopening a ticket (staff direct or student request) resets the resolution SLA. Current M6 behaviour: `slaResolveBreached` stays true once flipped, even if the ticket is reopened; the existing `slaResolveDeadline` is not adjusted. Practical effect: admins see the breach "sticky" in dashboards past reopen. If product wants a fresh 5d/15bd window on reopen, `reopenTicket` would need to reset the deadline + breach flags.
**Impact:** Low for Phase 1 (SLA dashboard is reporting, not blocking). Easy fix if product decides.

## Q-M7-01 — Course completion predicate drops the "all modules opened" clause — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — simplified predicate is final: `all quizzes passed + final exam passed`. No `POST /modules/:id/mark-opened` endpoint. Rationale: Logan's Q3 ruling dropped watch-time/page-open telemetry entirely (CLAUDE.md §4 item 11). "Content opened" is unobservable without that telemetry; building it just to gate certificates is over-engineering for Phase 1. Students can't game the quizzes (MCQs are graded objectively). Revisit in Phase 2 only if LUC adds content-completion telemetry for separate reasons.
**Raised:** 2026-04-22 (M7).
**Owner:** Logan.
**Context:** PRD §13.1 says "all Modules' content opened + all Quizzes passed + Final Exam passed". But M3 (Logan's Q3 ruling, CLAUDE.md §4 item 11) shipped NO watch-time / page-open telemetry. Without a `ModuleAccess` collection, "content opened" is unobservable. D-061 simplifies the predicate to "all quizzes passed + final exam passed" and pushes this for Logan's ratification. If Logan wants the original rule enforced, M7 needs a minimal `POST /v1/modules/:id/mark-opened` endpoint that the student UI hits on content tab open; service would AND that set into the completion check.
**Impact:** Medium. Without confirmation, the `course.completed` DomainEvent (M8 Certifier.io trigger) may fire a step earlier than some stakeholders expect. Easy fix in either direction.

## Q-M7-02 — Assessment + feedback WhatsApp templates
**Raised:** 2026-04-22 (M7).
**Owner:** LUC ops / Logan.
**Context:** PRD §11.3 says feedback notifications are email + in-app only at launch; §14.3 registry does not include assessment-graded WhatsApp. M7 ships `assessment.graded` and `feedback.published` with `channels: ['inapp', 'email']` — no WhatsApp. Meta has three pre-approved templates (fee_due, payment_received, ticket_update); assessment-related templates are not in that set. If product wants WhatsApp on these events, new templates need Meta approval first.
**Impact:** Low for Phase 1. Extending the channel map + adding a WABA template mapping is a single-commit change if/when templates land.

## Q-M7-03 — Faculty weekly digest scope (ungraded essays + draft feedback?) — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — keep both categories (ungraded essays >7d + stale feedback drafts >7d) in the same Monday 09:00 IST digest. Rationale: both represent the same faculty-workflow problem (student waiting on feedback) and separating them would create two emails to read instead of one. Cron logic stays as-is (D-063).
**Raised:** 2026-04-22 (M7).
**Owner:** Logan.
**Context:** TRD §10.1 calls the cron "faculty weekly feedback-coverage email" and PRD US-FB-04 frames coverage as "% of assignments with feedback within 7 days". D-063 implements "awaiting feedback" as the union of (a) ExamAttempts submitted >7d ago with no total score (ungraded essays) AND (b) FeedbackEntry drafts untouched >7d. Logan should confirm both categories belong in the same digest or whether stale drafts should be excluded.
**Impact:** Low. One filter toggle in `buildFacultyDigestBuckets`.

## Q-M7-04 — Quiz/exam state machine final terminal transitions — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — keep 4 states (`Draft → Scheduled → Live → Closed`). Grading is a per-attempt property; a per-exam "Graded" state adds machinery with no UX win. Faculty can see "X of Y attempts graded" in the grading queue without a state flip. No code change.
**Raised:** 2026-04-22 (M7).
**Owner:** Logan.
**Context:** PRD §12.2 lists `Draft → Scheduled → Live → Closed → Graded`. M7 implements four states (no separate "Graded") — once all attempts are graded, the exam remains "closed" and grading completeness is a per-attempt property, not a per-exam one. If product wants a fifth "graded" state flipped when 100% of attempts are graded, we'd add a terminal transition + a reconciliation cron or a hook on `gradeExamAttempt`. Currently no UI surface depends on this.
**Impact:** Low. Easy additive.

## Q-M7-05 — Test-ordering flake on `payments.record.test.ts`
**Raised:** 2026-04-22 (M7, carries M6 observation).
**Owner:** Vidit.
**Context:** `tests/integration/payments.record.test.ts` intermittently returns 404 on `POST /v1/payments` when run inside the full suite; passes in isolation and on retry. First observed in M6 coverage run; reproduced (once) during M7 full-suite run. Not a code regression — two consecutive M7 full-suite runs (post-M7 code) show 364/364 green. Likely test-bleed from a neighbouring test that drops the route before payments runs. Deserves a proper investigation before M9 deploy to avoid flakes in CI.
**Impact:** Medium only because it can cause spurious CI failures. Safe to ignore during M7; schedule for M8 debugging bandwidth.

## Q-M8-01 — API cost rates: confirm against real provider invoices
**Raised:** 2026-04-22 (M8).
**Owner:** Logan / LUC ops.
**Context:** PRD §15 requires a cost tracker but doesn't specify per-event rates. D-070 ships env-configurable defaults: `EMAIL_UNIT_PAISE=50`, `WHATSAPP_UNIT_PAISE=200`, `STORAGE_UNIT_PAISE=5`, `CERTIFIER_UNIT_PAISE=2500`. These are India-typical estimates. Once we have one month of real Resend/WABA/Cloudinary/Certifier invoices, adjust the env vars; historical `ApiCostLedger` rows keep their snapshot `unitPaise` so the past doesn't re-price.
**Impact:** Low for Phase 1 — admin-dashboard number is directionally correct. Revisit after one month of live usage.

## Q-M8-02 — Cert reissue when a course is updated (publishedVersion bumps)
**Raised:** 2026-04-22 (M8).
**Owner:** Logan.
**Context:** If an admin republishes a course after the student's certificate has been issued, the Certifier.io URL still references the old content snapshot. D-030 (M3) decided `Course.publishedVersion` increments but enrolments don't snapshot it. Similarly, the certificate just points to whatever the student completed. If a future publish changes the curriculum materially, should previously-issued certificates be reissued? Currently no policy: admin must manually trigger `POST /v1/enrollments/:id/issue-certificate` for each affected enrolment, and because that endpoint is idempotent against `certificateUrl`, a forced reissue would require first clearing the URL.
**Impact:** Low for Phase 1 (no republish-heavy workflow expected). If needed later, add `POST /v1/enrollments/:id/reissue-certificate` that clears + re-calls.

## Q-M8-03 — Notifications-retry cron schedule in render.yaml — **CLOSED 2026-04-22 (M9)**
**Raised:** 2026-04-22 (M8).
**Closed:** 2026-04-22 (M9). `il-cron-notifications-retry` ships in [render.yaml](../render.yaml) at `*/15 * * * *`. The cron command is `node scripts/sign-job-jwt.mjs notifications-retry`.

## Q-M8-04 — Scoped analytics tiles for finance + faculty
**Raised:** 2026-04-22 (M8).
**Owner:** Logan (product scope).
**Context:** PRD §3.1 grants finance `👁 (finance-only)` and faculty `👁 (own courses)` read access on the analytics dashboard. M8 backend is admin/superadmin only — a finance user calling `GET /v1/analytics/summary` gets 403. Scoped subsets (finance dashboard showing only collections + outstanding; faculty showing only quiz-performance-per-own-course) are M9 polish. The underlying aggregates already exist; we just need new endpoints + UI with tight role scoping.
**Impact:** Medium — finance + faculty UI currently shows placeholder dashboards. Acceptable for internal test in June; blocks full launch.

## Q-M8-05 — PWA icon set + offline fallback polish
**Raised:** 2026-04-22 (M8).
**Owner:** Vidit (M9) + Logan (logo SVG blocker Q-PENDING-01).
**Context:** `web/public/manifest.webmanifest` references `/favicon.svg` as the lone icon. Real PWA needs 192px + 512px rasters + maskable variants. Full workbox runtimeCaching rules (stale-while-revalidate for dashboard/timetable/courses, network-first for auth) and a `/offline` fallback route are deferred to M9.
**Impact:** Installable on mobile now with a placeholder icon; won't pass Lighthouse PWA gate until M9.

## Q-M8-06 — Deep UI build-out backlog for M9
**Raised:** 2026-04-22 (M8).
**Owner:** Vidit (M9).
**Context:** M8 delivered working auth + student + finance payment flow + admin dashboard + analytics + core CRUD pages, with `Placeholder` stubs on: quiz/exam attempt, admin Batches / Timetable-builder / Enrollments (inc. Issue Certificate button) / Audit-logs / Ticket-detail, finance payments list + reverse + CSV, faculty grading + feedback editor. APIs are all wired and tested; UIs port directly from [webapp/screens-staff.jsx](../../webapp/screens-staff.jsx) + [webapp/screens-extras.jsx](../../webapp/screens-extras.jsx) + [webapp/screens-student2.jsx](../../webapp/screens-student2.jsx).
**Impact:** High for full launch; mitigated for internal test in June by the admin-can-curl + existing CLI tools.

## Q-VERIFY-01 — Web login (and refresh + accept-invite) never sends `deviceId` — **CLOSED 2026-04-22 (pre-launch)**
**Closed:** 2026-04-22 — fixed in same session. Added [web/src/lib/deviceId.ts](../web/src/lib/deviceId.ts) (lazy `crypto.randomUUID()` → `localStorage['il:deviceId']`, falls back to `Date.now+Math.random` when localStorage is inaccessible). Wired into `authApi.login`, `authApi.acceptInvite` (endpoints.ts) and the 401-refresh interceptor (api.ts). Playwright now 12/32 green (was 3/32). Remaining 20 failures are split between 17 axe color-contrast violations (Q-VERIFY-03) and 3 UI-label drift assertions (Q-VERIFY-04). See D-085.
**Raised:** 2026-04-22 (pre-launch verification).
**Owner:** Vidit (code fix).
**Context:** Found during Part B4 Playwright — 29/32 tests fail. Root cause: [web/src/lib/endpoints.ts:33-38](../web/src/lib/endpoints.ts#L33-L38) `authApi.login` POSTs only `{ email, password }`. Server requires `deviceId: z.string().min(1).max(128)` per [api/src/routes/auth.ts:20-24](../api/src/routes/auth.ts#L20-L24). Same gap on `POST /auth/invite/accept` and `POST /auth/refresh`. This is Q-M2-01 ("plan is UUIDv4 in localStorage, not yet enforced") finally biting — no browser has ever actually logged in without a curl-constructed deviceId.
**Impact:** Hard blocker for any real user — not a test-only issue. The M9 memory checkpoint's claim that "Playwright auth + role routing passes" was aspirational; nothing in the CI or local dev flow exercised a real browser login until this session.

## Q-VERIFY-03 — Brand color contrast fails WCAG 2 AA (17 axe "serious" violations)
**Raised:** 2026-04-22 (pre-launch verification, post-deviceId-fix Playwright run).
**Owner:** Rejin / Logan (brand decision).
**Context:** axe reports 17 `color-contrast` serious violations across login + every authenticated page. Root cause: the India Learns brand palette uses orange `#f58220` on navy `#1a3a8f` for emphasis text/headings; the ratio is **3.95:1** vs the WCAG AA requirement of **4.5:1** for normal text. Bold/large text (≥14pt bold or ≥18pt) only needs 3:1 and is fine. Fix options (one brand decision fixes all 17 pages): (a) darken navy to ~`#15307A` (→ 4.52:1, within the original palette family), (b) darken orange to ~`#D9691A` (→ 4.54:1), (c) restrict the orange-on-navy combo to bold 14pt+ headings only and switch body text back to a neutral gray. (c) preserves the brand palette exactly; (a) is least visually disruptive; (b) shifts the primary action color noticeably.
**Impact:** WCAG 2.1 AA is called out in UI/UX §10 and root CLAUDE.md §11 (`design:accessibility-review`) as a Phase 1 target. Failing AA is a compliance gap for LUC.
**Recommendation:** Ask Rejin for (a) or (c). (c) is my default if no response.

## Q-VERIFY-04 — Student-journey Playwright: label mismatches on courses/fees/tickets nav + new-ticket description field
**Raised:** 2026-04-22 (pre-launch, post-deviceId-fix Playwright run).
**Owner:** Vidit (operator / test fixup).
**Context:** 3 `student-journey.spec.ts` assertions failed after login now works: (1) `dashboard tiles render with seeded data` — the expected tile text didn't match the current dashboard copy; (2) `navigates to courses, fees, tickets` — sidebar link label regex didn't match (app renders "My Courses" vs test expects "Courses", or similar drift); (3) `opens the new-ticket form` — `getByLabel(/description/i)` doesn't find the textarea (might be rendered as an aria-label or placeholder, not a `<label>`). Each is ~5 minutes of either aligning the test regex to the current copy or adding a matching `<label>` on the form. Not a launch blocker — the app itself works in the browser; this is test brittleness.
**Impact:** Low. Playwright coverage is reduced until fixed; real users are unaffected.

## Q-VERIFY-02 — Atlas cluster region — **DECIDED 2026-05-20 (operator)**
**Decided:** 2026-05-20 — operator confirmed the existing Atlas cluster stays as-is for Phase 1. No fresh provisioning. M10q (GridFS) also uses this same cluster for file storage. Region confirmation for BRD BR-11 (DPDP Act) is something the operator will validate against the Atlas dashboard themselves; not a code or config blocker.
**Raised:** 2026-04-22 (pre-launch verification).
**Owner:** Vidit (closed by operator).
