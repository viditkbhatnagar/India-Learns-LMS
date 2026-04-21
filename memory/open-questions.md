# Open questions — India Learns LMS

Anything blocked on Logan / Vidit / external input. Reference Q-numbers when raising with stakeholders.

---

## Q-M1-01 — Brand name: "India Learns" or "India LearnHub"?
**Raised:** 2026-04-21 (M1)
**Owner:** Logan
**Context:** `claude-code-docs/CLAUDE.md`, `01_BRD.md`, `03_TRD.md`, `04_UI_UX_Spec.md` all say "India Learns" with `app.indialearns.com`. Root `/CLAUDE.md` and `PROMPTS.md` (some sections) say "India LearnHub" with `app.indialearnhub.com`. M1 implementation uses "India Learns" per source-of-truth hierarchy. Need confirmation before M9 deploy + DNS purchase.
**Impact if wrong:** Trivial fix (UI copy + `<title>` + env defaults), but affects domain registration — must be locked before M8/M9.

## Q-PENDING-01 — Official India Learns logo SVG
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

## Q-M2-01 — `deviceId` convention for login/refresh/invite-accept
**Raised:** 2026-04-21 (M2)
**Owner:** Vidit (lock when M3 web client starts).
**Context:** Server accepts `deviceId` as a free-form non-empty string in the login/refresh/invite-accept bodies. Plan is UUIDv4 persisted in localStorage. Decision isn't yet enforced.
**Impact:** Low. When M3 lands, either enforce UUID-v4 format server-side or keep it opaque (server only uses it for the RefreshToken audit trail).

## Q-M2-02 — Password-reset audit email PII
**Raised:** 2026-04-21 (M2).
**Owner:** Logan (DPDP readiness sign-off).
**Context:** `auth.password_reset_requested` audit log stores the submitted email in plain text in `details.email` so debugging "who tried to reset" is easy. Audit log is admin-gated (M6 UI). If DPDP interpretation requires hashed emails in audit, swap to sha256.
**Impact:** Low; one-line change in `authService.requestPasswordReset`.

## Q-M2-04 — `__Host-il_rt` cookie Path spec drift
**Raised:** 2026-04-21 (M2 review).
**Owner:** Vidit (spec note) + Logan (if TRD amendment needed).
**Context:** TRD §7 specifies the refresh cookie as `__Host-il_rt` with `Path=/v1/auth/refresh`. RFC 6265bis (and Chrome/Firefox/Safari enforcement) requires `__Host-`-prefixed cookies to have `Path=/` and no `Domain` attribute — otherwise browsers silently drop the cookie. M2 keeps the prefix and widens Path to `/` (security-positive choice). Route-level auth middleware gates where the cookie is actually consumed. TRD wording should be amended in a future doc update.
**Impact:** None functionally — current implementation works in real browsers and preserves the `__Host-` guarantees. The TRD should be reconciled before M9 to avoid confusion.

## Q-M2-03 — Rate-limit store swap for multi-instance deploy
**Raised:** 2026-04-21 (M2).
**Owner:** Vidit (M9 deploy prep).
**Context:** `express-rate-limit` uses in-memory store. OK for single-instance dev; Render free-tier has one instance per service. Once we scale to 2+ instances (not Phase 1), need `rate-limit-redis` so counters aren't per-replica. Runbook note required.
**Impact:** None in Phase 1; revisit before scale-out.

## Q-M3-01 — Enrollment `courseVersion` pointer for unpublish rollback
**Raised:** 2026-04-21 (M3).
**Owner:** Logan (product call on whether unpublish rollback is in Phase 1 scope).
**Context:** PRD §6.3 says "Publish creates a new immutable `courseVersion` pointer on affected enrolments — unpublishing rolls back." TRD §4.4 Enrollment schema does not include a courseVersion field; no rollback user story exists yet. D-030 defers this: `Course.publishedVersion` increments on publish, but enrolments don't snapshot it. If Logan wants rollback in Phase 1, we'll add a `coursePublishedVersion: number` field on Enrollment + a rollback endpoint that pushes subsequent publishes' previous assets back.
**Impact:** Medium. No current feature depends on it, but admin-triggered unpublish currently loses the "which version did each student see" history.

## Q-M3-02 — Batch status state-machine transitions
**Raised:** 2026-04-21 (M3).
**Owner:** Logan / Vidit (spec).
**Context:** TRD §4.3 defines `status: 'planned' | 'active' | 'completed' | 'archived'`, but neither PRD nor TRD specifies the transition rules (who flips, when, what's allowed). M3 admin PATCH accepts any status transition with no validation. Fine for Phase 1 (admins drive manually), but worth codifying before M8 analytics start grouping by batch status.
**Impact:** Low; admins could accidentally "archive" an active batch. Soft constraint; recoverable.

## Q-M3-03 — Module deletion policy when module.viewed events exist
**Raised:** 2026-04-21 (M3).
**Owner:** Logan.
**Context:** Current implementation soft-deletes Module on `DELETE /v1/modules/:id`. AuditLog rows for `module.viewed` reference `targetId = module._id`, which now points at a tombstoned doc. M6 audit UI will need to handle "module deleted but audit rows remain". Also open: should we prevent deletion when there are view events, or allow and just mark? Plan's integration test for `9 delete with viewed audit rows` wasn't added because the behaviour isn't spec'd — we silently allow.
**Impact:** Low. M6 UI will resolve this; safe default today is "allow soft-delete, preserve audit rows."

## Q-M4-01 — TimetableOverride `action='add'` extends the TRD enum
**Raised:** 2026-04-21 (M4)
**Owner:** Logan (spec ratification).
**Context:** TRD §4.5 enumerates `action: 'cancel' | 'reschedule'`. The M4 prompt §3 explicitly requires **cancel, reschedule, add**. Shipped as an additive extension: `'add'` with `entryId: null` represents a one-off extra class (newCourseId + newFacultyId + new time required). Need Logan's sign-off on the spec amendment.
**Impact:** Medium. The behaviour is merged and tested; the TRD text just needs to catch up.

## Q-M4-02 — Faculty `/v1/me/timetable` filter rule
**Raised:** 2026-04-21 (M4)
**Owner:** Logan (spec clarity).
**Context:** PRD §8.2 US-TT-04 says "As Faculty, I see only my own classes." M4 implements this by filtering resolved occurrences to `facultyId === self`. Works today — but a coordinator or multi-role user (future-proof) might want all-faculty-on-their-batches visibility.
**Impact:** Low. Current behaviour matches the literal PRD wording.

## Q-M4-03 — Notification retention policy
**Raised:** 2026-04-21 (M4)
**Owner:** Vidit (M9 runbook author).
**Context:** `Notification` docs accumulate per user per event with no TTL. In-app inbox UI (M8) will likely want pagination + archive; for now, `/v1/notifications/me?limit=50` is the only read path.
**Impact:** Low for Phase 1 scale (≤ 126 admissions Y1); revisit before scale-out. Likely: add a `retainUntil` Date + TTL index OR a cron that archives `readAt`-set docs older than 90 days.

## Q-M4-04 — Room-overlap detection scope
**Raised:** 2026-04-21 (M4)
**Owner:** Logan.
**Context:** `assertNoOverlap` rejects same-room overlaps across **all batches** (room = physical resource). Empty `room: ''` never conflicts. PRD §8.3 AC says "No two timetable entries overlap for the same Batch, same Faculty, or same Room" — ambiguous whether "same Room" scoping is cross-batch. Current implementation is the stricter reading (cross-batch).
**Impact:** Low. If Logan wants per-batch room scoping, add `batchId` equality to the room branch of the $or.

## Q-M4-05 — Notification copy currently hardcoded
**Raised:** 2026-04-21 (M4)
**Owner:** Vidit (M8 template registry author).
**Context:** `notifyTimetableChange` renders its own title/body strings (e.g. "Timetable update: Airport Ground Ops rescheduled"). Copy should move into the M8 template registry so Logan/Rejin can edit without a code change. Currently English-only; i18n TBD.
**Impact:** Low. Copy works for Phase 1; templates harden in M8.
