# Decisions — India Learns LMS

Append-only log. Every entry: ID, date, decision, why, source.

---

## D-001 — Brand name is "India Learns" (not "India LearnHub")
**Date:** 2026-04-21
**Why:** Spec pack (`claude-code-docs/CLAUDE.md`, `01_BRD.md`, `03_TRD.md`, `04_UI_UX_Spec.md`) uniformly says "India Learns" + `app.indialearns.com`. Root `/CLAUDE.md` says "India LearnHub" + `app.indialearnhub.com`. The GitHub repo is `India-Learns-LMS`. Source-of-truth hierarchy (TRD > PRD > BRD > UI/UX > root CLAUDE.md) resolves to "India Learns".
**Source:** TRD §1 line 3, BRD §1 line 3, UI/UX §1. Contradiction vs `/CLAUDE.md` §1.
**How to apply:** Use "India Learns" in all UI copy, `<title>`, env defaults (`WEB_ORIGIN=https://app.indialearns.com`). Flagged in [open-questions.md](open-questions.md) Q-M1-01 for Logan to confirm before M9 go-live.

## D-002 — Health endpoint at `GET /health` for M1
**Date:** 2026-04-21
**Why:** PROMPTS.md M1 DoD and root `/CLAUDE.md` §4 say `/health`. TRD §14 says `/healthz` + `/readyz`. For M1 the milestone prompt is binding; `/healthz` + `/readyz` get added in M9 deploy prep.
**Source:** PROMPTS.md M1, root `/CLAUDE.md` §4 step 3.
**How to apply:** Implement `GET /health` returning `{ ok, commit, uptimeSec, ts }`. Do **not** also add `/healthz`/`/readyz` now.

## D-003 — API port = 4000 in dev
**Date:** 2026-04-21
**Why:** PROMPTS.md DoD says port 4000. TRD §12 has `PORT=10000` (Render's default). Env schema accepts any port; default 4000 for local dev, Render injects its own in prod.
**Source:** PROMPTS.md DoD, TRD §12.
**How to apply:** `api/.env.example` defaults `PORT=4000`. Zod parses as number, no hard constraint.

## D-004 — Repo dir stays `INDIA-LEARNS-LMS`; package name `india-learns`
**Date:** 2026-04-21
**Why:** TRD §2 shows `india-learns/`, root CLAUDE.md §5 shows `india-learnhub/`. Actual on-disk path is `INDIA-LEARNS-LMS` and GitHub repo matches. No value in renaming the directory.
**Source:** TRD §2, filesystem.
**How to apply:** Root `package.json` `"name": "india-learns"`. Keep dir name as-is.

## D-005 — Locked stack (from TRD §3)
**Date:** 2026-04-21
**Why:** Stack is locked in TRD §3 and root CLAUDE.md §3. Node 20.12 LTS, MongoDB 7 on Atlas (AWS ap-south-1), TypeScript 5.4, ESM throughout, npm 10 workspaces. Auth: Argon2id + `jose` (not bcrypt, not jsonwebtoken). Dates: `date-fns` + `date-fns-tz` (not Moment). Money: integer paise.
**Source:** TRD §3.1–3.4, root `/CLAUDE.md` §3, §5.
**How to apply:** Any new dependency not in TRD §3.2/§3.3 requires a `DEPENDENCY_REQUEST.md` at repo root per TRD §3.4.

## D-006 — Monorepo shape: `api/`, `web/`, `packages/shared-types/`
**Date:** 2026-04-21
**Why:** TRD §2 + root CLAUDE.md §5. Shared types live in `packages/shared-types` and are imported by both `/api` and `/web` to prevent DTO drift.
**Source:** TRD §2.
**How to apply:** Workspace name `india-learns-shared-types`. Ship source-only (no build step) — consumers resolve `.ts` directly via TS + tsx + Vite.

## D-007 — WhatsApp templates at launch: three only
**Date:** 2026-04-21
**Why:** TRD §9.3 specifies `il_fee_due`, `il_payment_received`, `il_ticket_update`. Others require Meta pre-approval and are out of scope for Phase 1.
**Source:** TRD §9.3.
**How to apply:** `WhatsAppService.sendTemplate()` supports only these three template names; stub logger in dev; `WHATSAPP_ENABLED=false` default.

## D-008 — Complaint ticket precondition is stricter than BRD wording
**Date:** 2026-04-21
**Why:** A Complaint may only be filed if the student has a prior Resolved or Closed ticket (escalation-only). Server enforces and returns `COMPLAINT_PRECONDITION_UNMET`.
**Source:** BRD BR-06, TRD §8 error code table, TRD §6 `ticketService`.
**How to apply:** `ticketService.create()` runs the precondition check before persisting.

## D-009 — No AI features in Phase 1
**Date:** 2026-04-21
**Why:** BRD §6.2 explicitly defers AI flashcards, voice AI, AI quiz generation, live-class scheduling, and payment gateways. Root CLAUDE.md §7 reinforces.
**Source:** BRD §6.2, root `/CLAUDE.md` §7.
**How to apply:** Do not add these even if tempting. If Logan requests mid-build, spec it through `product-management:write-spec` first.

## D-010 — ESLint config strategy
**Date:** 2026-04-21
**Why:** Root CLAUDE.md §5 says "airbnb-base + @typescript-eslint". ESLint 9 flat config is the default in 2026, but `eslint-config-airbnb-base` has not yet shipped a flat-config build. Use `@eslint/eslintrc`'s `FlatCompat` to pull airbnb-base in as a legacy preset, then layer `typescript-eslint`'s flat config on top. Not blocking; swap to pure-flat (`@antfu/eslint-config` or `eslint-config-standard`) is a one-file change if requested.
**Source:** Root `/CLAUDE.md` §5 + current npm ecosystem state.
**How to apply:** Root `eslint.config.js` uses `FlatCompat`. Devdeps include `@eslint/eslintrc`, `eslint-config-airbnb-base`, `eslint-plugin-import`, `typescript-eslint`.

## D-011 — PWA service worker disabled in dev until M9
**Date:** 2026-04-21
**Why:** `vite-plugin-pwa` in dev mode can cache stale assets and confuse hot reload. M1 only needs the manifest to prove the plugin is wired. Full SW + offline fallback lands in M9 polish (per root CLAUDE.md §4 M9 step 29).
**Source:** Root `/CLAUDE.md` §4 M9.
**How to apply:** `vite-plugin-pwa` registered with manifest + `registerType: 'prompt'` + `injectRegister: false`. `VITE_ENABLE_PWA=true` env flag stays for M9 to flip.

## D-012 — Refresh token read cookie-only from `__Host-il_rt`
**Date:** 2026-04-21
**Why:** TRD §7 pins the refresh cookie as `__Host-il_rt` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/v1/auth/refresh`). Keeping a single read path avoids a dead JSON-body branch that the web client (M3) will never exercise. Curl examples use `--cookie`.
**Source:** TRD §7.
**How to apply:** `POST /v1/auth/refresh` reads the token only from `req.cookies[REFRESH_COOKIE_NAME]`. In dev, `COOKIE_SECURE=false` lets cookies flow over http://localhost; production must flip to true. Implemented in [api/src/utils/cookies.ts](../api/src/utils/cookies.ts) and [api/src/routes/auth.ts](../api/src/routes/auth.ts).

## D-013 — RefreshToken extended with `familyId` for O(1) reuse revocation
**Date:** 2026-04-21
**Why:** Your M2 prompt and TRD §7 require "refresh-token rotation with reuse → family invalidated". TRD §4.11 only lists `rotatedFromId`; walking that chain on every verify is O(depth). Adding `familyId: ObjectId` (= root token's `_id`) gives us a single indexed query to revoke the whole family. Spec extension, not contradiction.
**Source:** TRD §4.11 + §7.
**How to apply:** `familyId` set at `issueRefreshToken()` (new ObjectId) and copied to every rotated descendant. On presented-but-already-revoked token → `RefreshToken.updateMany({familyId, revokedAt:null}, {revokedAt:now})`. See [api/src/services/refreshTokenService.ts](../api/src/services/refreshTokenService.ts).

## D-014 — User `code` (`IL-<YYYY>-<NNNN>`) assigned only to students + faculty
**Date:** 2026-04-21
**Why:** TRD §4.1 comment "IL-2026-0001 for students, faculty etc" is the source of truth. Admin/Superadmin/Finance never appear on rosters, so a code is noise. Year-scoped global counter in a new `Counter` collection lets M5/M6 reuse the same sequencer for Invoice, Ticket, Receipt prefixes.
**Source:** TRD §4.1 + CLAUDE.md §5.
**How to apply:** `userService.createUser` calls `counterService.nextUserCode(year)` only when `role ∈ {student, faculty}`. Counter key = `user_code_<year>`. Zero-padded to 4 digits. See [api/src/services/counterService.ts](../api/src/services/counterService.ts).

## D-015 — Every login attempt (success + failure) is audit-logged
**Date:** 2026-04-21
**Why:** PRD §5.2 acceptance criteria: "Login attempts, successful and failed, are logged to audit_logs with IP and UA." Not optional.
**Source:** PRD §5.2.
**How to apply:** `authService.login()` writes `auth.login.success` on happy path and `auth.login.failure` on every rejection (unknown user, bad password, locked, suspended). Failure reasons land in `auditLog.details.reason` so we can distinguish `{unknown_user, bad_password, locked, suspended}` in audit review.

## D-016 — Integration mode toggle `INTEGRATIONS_MODE=stub|live`
**Date:** 2026-04-21
**Why:** M2 is server-only and all third-party keys (Resend, Meta WABA) are still PENDING. Need a dev-safe default that exercises the adapter contract without hitting live APIs, but that can be flipped on in later milestones without code edits.
**Source:** TRD §9.2–§9.3, CLAUDE.md §8.
**How to apply:** `INTEGRATIONS_MODE=stub` (default) returns `ConsoleEmailAdapter` + `ConsoleWhatsAppAdapter` from [api/src/integrations/index.ts](../api/src/integrations/index.ts), which log the payload via pino at `info`. Live mode wires Resend / SendGrid / Meta WABA adapters — currently stubs that throw. Tests override via `setIntegrations({ email: SpyEmailAdapter, whatsapp: SpyWhatsAppAdapter })`.

## D-017 — AuditLog `before`/`after` diff strips PII via `scrubUser()`
**Date:** 2026-04-21
**Why:** BR-11 (DPDP) requires PII minimisation. Logging the full User snapshot would leak `passwordHash`, `passwordHistoryHashes`, and lockout counters into the audit trail — all of which are recoverable via live lookups anyway, so no forensic loss.
**Source:** BRD BR-11, TRD §11.
**How to apply:** `scrubUser(doc)` in [api/src/services/auditService.ts](../api/src/services/auditService.ts) deep-clones to a plain object, drops `passwordHash, passwordHistoryHashes, loginFailCount, lockedUntil, __v`, and maps `_id → id`. Called by every service before writing `before`/`after`.

## D-018 — `mongoose.models.X ?? model(...)` idempotent model registration
**Date:** 2026-04-21
**Why:** Vitest isolates test-file module graphs by default, but mongoose's module-level model registry is shared across the process. Naive `model('User', schema)` in a reimported file throws `OverwriteModelError`.
**Source:** M2 test-harness debugging.
**How to apply:** Every model file exports `export const X = mongoose.models.X as Model<XDoc> | undefined ?? model<XDoc>('X', schema)`. Applied to User, InviteToken, RefreshToken, AuditLog, Counter in [api/src/models/](../api/src/models).

## D-021 — Fees-suspended users keep login access; manual-suspended do not
**Date:** 2026-04-21
**Why:** PRD §3.2 + §9.5 state a fees-suspended student "can still log in, see the Fees page, and raise a Finance-category ticket". Blocking them at the login wall traps them in a no-payment deadlock. M2 review caught the original M2 behaviour as a spec violation.
**Source:** PRD §3.2 line 94, PRD §9.5 line 319.
**How to apply:** `authService.login()` and `middleware/auth.ts:requireAuth` 403 `SUSPENDED_ACCESS` only when `status === 'suspended' && suspensionKind === 'manual'`. Fees-suspended sessions pass through with full access; page-level middleware (M5) will restrict them to `/fees`, `/profile`, `/tickets/new?category=Finance`. Integration test: `api/tests/integration/auth.login.test.ts::allows a fees-suspended student to log in`.

## D-022 — `POST /v1/users` is admin-only (no superadmin)
**Date:** 2026-04-21
**Why:** TRD §5.2 table entry pins the role to `admin`. PRD §3.1 matrix explicitly gives superadmin ❌ on all "Create / edit ..." rows. M2 review flagged original `requireRole('admin', 'superadmin')` as a spec violation.
**Source:** TRD §5.2 line 641, PRD §3.1.
**How to apply:** Route middleware is `requireRole('admin')` only; `userService.createUser()` asserts `actor.role === 'admin'`. `GET /v1/users` list stays admin + superadmin (read-only). Integration test: `api/tests/integration/users.crud.test.ts::refuses POST /v1/users from a superadmin`.

## D-023 — Atomic refresh-token rotation + atomic login-fail counter
**Date:** 2026-04-21
**Why:** Original read-modify-write implementations had TOCTOU races: concurrent refreshes from StrictMode / axios retry could produce two live rotated tokens from one parent without tripping reuse detection; concurrent bad-password attempts could lose `loginFailCount` increments and defeat the lockout threshold.
**Source:** M2 review.
**How to apply:** `rotateRefreshToken` uses `findOneAndUpdate({ tokenHash, revokedAt: null }, { $set: { revokedAt: now } })`. Losers see `null` → discriminate reuse vs unknown-token via a follow-up read, revoke the family on reuse. `login()` bad-password path uses `User.findOneAndUpdate(..., { $inc: { loginFailCount: 1 } })` + conditional lock set.

## D-020 — `loadEnv()` refuses dev-default or weak secrets in production
**Date:** 2026-04-21
**Why:** `JWT_SECRET` and `JOB_SECRET` fall back to the literal dev default (`change-me-dev-only`) in the Zod schema so local dev just works. That silent default in production would allow any reader of the public repo to forge JWTs for any existing user (including the superadmin). Security review flagged as the sole high-confidence M2 vulnerability.
**Source:** M2 security-review (2026-04-21).
**How to apply:** `assertProdSecrets()` in [api/src/config/env.ts](../api/src/config/env.ts) runs after zod parsing. When `NODE_ENV === 'production'`, it throws if `JWT_SECRET` / `JOB_SECRET` matches any of `{'change-me-dev-only', 'change-me', ''}` or is shorter than 32 chars. Dev/test bypass this check. Test coverage in [api/tests/unit/env.test.ts](../api/tests/unit/env.test.ts).

## D-019 — `RATE_LIMITS_DISABLED` env flag for test determinism
**Date:** 2026-04-21
**Why:** `express-rate-limit`'s in-memory store persists across tests within a process. Full-suite runs would sporadically trip the limiter from earlier tests' requests, making any rate-limit assertion flaky. Needed a clean on/off switch.
**Source:** M2 test-harness debugging (TRD §7 leaves store choice to implementation; Redis-swap is M9 concern).
**How to apply:** Default `false` in prod/dev (env.ts). Default `true` in test via `tests/helpers/env.ts`. The dedicated [api/tests/integration/rateLimit.test.ts](../api/tests/integration/rateLimit.test.ts) flips it back on, overrides `LOGIN_RATE_MAX=3` / `PASSWORD_RESET_RATE_MAX=2`, and creates a fresh `createApp()` so counters start from zero.

## D-024 — Faculty → Course ownership via `Course.facultyIds: [ObjectId ref User]`
**Date:** 2026-04-21
**Why:** PRD §3.1 grants Faculty "Upload module videos / PDFs ✅ (own courses)" but neither PRD nor TRD §4.2 specifies how "own courses" is stored. `User.isCourseCoordinator` is boolean-only; `Batch.coordinators` is batch-grain. Without an explicit assignment we'd either have to derive ownership through the (not-yet-built) Timetable or block faculty edits entirely. An explicit `facultyIds` array on Course is the simplest, forward-compatible source of truth.
**Source:** PRD §3.1 line 65, TRD §4.2 (gap). User confirmed via AskUserQuestion 2026-04-21.
**How to apply:** `facultyIds` array on [api/src/models/course.ts](../api/src/models/course.ts) indexed. Admin sets it on create/PATCH. `courseService.facultyAssignedToCourse(course, userId)` gates faculty reads and `moduleService.updateModule` content edits. M4 Timetable will validate `facultyId` against it.

## D-025 — Module inherits publish state from `Course.state`
**Date:** 2026-04-21
**Why:** TRD §4.2 specifies `state: 'sandbox'|'published'` on Course only, not Module. PRD §6.3 "Sandbox changes do not appear to students until Publish" and the `publishedVersion` pointer operate at course grain. Adding per-module state would diverge from the spec and complicate the M5 rollback story.
**Source:** TRD §4.2 (no state field on Module), PRD §6.3. User confirmed via AskUserQuestion.
**How to apply:** Module has no `state` field. Student visibility via `assertStudentCanViewModule` step 2: `course.state === 'published'` else 404.

## D-026 — Enrollment carries both `status` (lifecycle) and `accessState` (fee gate)
**Date:** 2026-04-21
**Why:** TRD §4.4 specifies `status: 'active' | 'expired' | 'revoked'` (lifecycle). The M5 prompt and the M3 prompt reference `accessState: 'active' | 'warn1' | 'warn2' | 'override' | 'suspended'` (fee engine output). These are orthogonal: status is set by admin + validity-date cron, accessState is flipped by the M5 fee-suspension state machine. Splitting them keeps the access-gate logic explicit and survives when M5 lands.
**Source:** TRD §4.4 + PROMPTS.md M5/M8 ("enrollment.accessState"). M3 prompt §5.
**How to apply:** Both fields on [api/src/models/enrollment.ts](../api/src/models/enrollment.ts). `accessState` defaults to `'active'` — nothing flips it in M3. `assertStudentCanViewModule` checks both: step 3 asserts `status === 'active'`, step 5 flips `status='expired'` if `validTo` is past, step 6 rejects if `accessState === 'suspended'`. M5 fee cron will mutate accessState.

## D-027 — Storage factory mirrors email/WhatsApp D-016 pattern
**Date:** 2026-04-21
**Why:** Existing env has two relevant knobs: `INTEGRATIONS_MODE=stub|live` (D-016) and `STORAGE_PROVIDER=cloudinary|stub`. Collapsing them into one factory keeps the dev-safe defaults aligned across all adapters. User prompt said "pick via INTEGRATIONS_MODE" but the email/WhatsApp pattern already reads both a mode flag and a provider flag — storage should match.
**Source:** M3 prompt §4, D-016.
**How to apply:** `getStorage()` in [api/src/integrations/index.ts](../api/src/integrations/index.ts) returns `ConsoleStorageAdapter` when `INTEGRATIONS_MODE==='stub'` OR `STORAGE_PROVIDER==='stub'`. `CloudinaryStorageAdapter` only when both go live; its methods throw until the Cloudinary SDK is wired (scheduled for M5 receipts).

## D-028 — Enrollment validity fields named `validTo` / `validFrom` (TRD wins)
**Date:** 2026-04-21
**Why:** M3 prompt §5 wrote `enrollment.validUntil`; TRD §4.4 specifies `validFrom` / `validTo`. Per CLAUDE.md §2 source-of-truth hierarchy, TRD wins on schema naming.
**Source:** TRD §4.4.
**How to apply:** Model + DTO + services use `validFrom` / `validTo` throughout. Documented for the session-end commit note.

## D-029 — `module.viewed` audit action allowed (opened-event only)
**Date:** 2026-04-21
**Why:** PRD §6.3 explicitly bans watch-time and per-page PDF tracking. A single "module opened" event for analytics — no second-by-second telemetry, no quiz-scroll signals — is compatible with that ban and matches the M3 prompt §5 ("log to AuditLog with action='module.viewed'").
**Source:** M3 prompt §5, PRD §6.3 (boundary).
**How to apply:** `module.viewed` appended to `AUDIT_ACTIONS` in [packages/shared-types/src/enums.ts](../packages/shared-types/src/enums.ts). Written by `recordModuleViewed` in [api/src/services/moduleAccessService.ts](../api/src/services/moduleAccessService.ts) only on the happy path of the student-access gate; best-effort, never blocks the response.

## D-030 — `courseVersion` pointer on Enrollment deferred past Phase 1
**Date:** 2026-04-21
**Why:** PRD §6.3 describes an "immutable courseVersion pointer on affected enrolments — unpublishing rolls back", but TRD §4.4 omits the field and no rollback user story exists yet. For Phase 1 we bump `Course.publishedVersion` on publish but don't snapshot it per enrolment; unpublish just flips `state='sandbox'`. Rollback semantics are not part of the June internal test / July launch scope.
**Source:** PRD §6.3 vs TRD §4.4 (contradiction). Logged as Q-M3-01.
**How to apply:** Enrollment schema has no `courseVersion` field. If Logan confirms rollback is needed, we'll add the pointer in a later amendment — additive, not destructive.

## D-031 — `GET /v1/enrollments/me` and `GET /v1/me/courses` are aliases
**Date:** 2026-04-21
**Why:** M3 prompt §3 named `/v1/enrollments/me`; TRD §5.3 named `/v1/me/courses`. Shipping both as aliases honours both contracts at zero cost and lets the M4+ web client call whichever matches the spec it's reading.
**Source:** M3 prompt §3 + TRD §5.3. User confirmed via AskUserQuestion.
**How to apply:** [api/src/routes/enrollments.ts](../api/src/routes/enrollments.ts) mounts `GET /me`. [api/src/routes/meCourses.ts](../api/src/routes/meCourses.ts) mounts `GET /` (as `/v1/me/courses`) against the same service call; both return identical `{ data: { enrolments: [...] } }` payloads.

## D-032 — No `code` field on Program/Course/Module/Batch/Enrollment
**Date:** 2026-04-21
**Why:** CLAUDE.md §5 specifies human-readable codes only on Student, Invoice, Ticket, Receipt. Program and Course use slugs (already in TRD §4.2). Module/Batch/Enrollment addressed by `_id` + contextual labels.
**Source:** CLAUDE.md §5 + TRD §4.2.
**How to apply:** None — models omit any `code` field for these resources.

## D-033 — Seed script seeds programs only; course/module trees left to admin UI
**Date:** 2026-04-21
**Why:** BRD §2.3 names the two Phase 1 programs ("Aviation Diploma", "Retail & Fashion Diploma", 300h each) but BRD/PRD don't specify course catalogues or module lists. Seeding speculative course trees would create drift once Logan provides the actual content plan.
**Source:** BRD §2.3; M3 prompt §1.
**How to apply:** [api/scripts/seed.ts](../api/scripts/seed.ts) upserts two Program rows by slug. Idempotent via `{ $setOnInsert }`. Invocation: `MONGODB_URI=… npm run seed -w api`. Test coverage in [api/tests/integration/seed.test.ts](../api/tests/integration/seed.test.ts) runs it twice to prove no duplicates.

## D-035 — Student course-access gate shared across `/v1/modules/:id` and `/v1/me/courses/:courseId`
**Date:** 2026-04-21
**Why:** Security review caught that `GET /v1/me/courses/:courseId` was returning the full module list (including `videoUrl`, `pdfUrl`, `pdfStorageKey`) while only checking `enrolment.status === 'active'`. A fee-suspended student (M5 flips `accessState='suspended'`) or an expired student (past `validTo`, before the M5 reconcile cron runs) could bypass the per-module gate by going through the catalog endpoint and just dereferencing the stored URLs directly.
**Source:** M3 security-review 2026-04-21.
**How to apply:** Extracted `assertStudentCanAccessCourse(student, course)` out of `moduleAccessService.assertStudentCanViewModule`. The per-module gate now delegates to it (masking the sandbox-course 404 as a module-404 to avoid probing). `GET /v1/me/courses/:courseId` in [api/src/routes/meCourses.ts](../api/src/routes/meCourses.ts) calls the same helper — one source of truth for "student may see this course's content." New integration file [api/tests/integration/meCourses.test.ts](../api/tests/integration/meCourses.test.ts) covers the 5 cases (happy, sandbox 404, not-enrolled, expired, suspended) end-to-end.

## D-034 — User.code index migrated from `sparse: true` to `partialFilterExpression`
**Date:** 2026-04-21
**Why:** M3 integration tests that create several null-code users (admin + multiple students) hit `E11000 { code: null }`. MongoDB 5+ `sparse: true` only skips missing fields, not explicit `null` values, and `default: null` on the `code` field wrote null into every non-coded doc. M2 tests only got lucky by creating ≤1 null-code user per case.
**Source:** M3 test-harness debugging.
**How to apply:** [api/src/models/user.ts](../api/src/models/user.ts) replaces the inline `unique: true, sparse: true` on `code` with a separate `UserSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } })`. Only string-valued `code` fields are indexed, so null admins/superadmins/finance coexist. No data migration needed yet — no prod deploy, mongodb-memory-server starts fresh per run.

## D-036 — `/v1/timetable` mounted as alias alongside `/v1/batches/:id/timetable` + `/v1/me/timetable`
**Date:** 2026-04-21
**Why:** TRD §5.5 specifies `/v1/batches/:id/timetable` (entry list) + `/v1/me/timetable?week=…`. M4 prompt §3 specifies a flat `/v1/timetable?batchId=&from=&to=` for resolved occurrences. These three endpoints serve different purposes (entry list vs resolved window vs per-user alias) so all three are mounted — no contradiction, and D-031 already established the alias pattern for `/v1/enrollments/me` vs `/v1/me/courses`.
**Source:** TRD §5.5 vs M4 prompt §3.
**How to apply:** [api/src/routes/index.ts](../api/src/routes/index.ts) mounts `batchTimetableRouter` under `/batches`, `timetableRouter` (flat resolver) and `timetableEntriesRouter` (`/:entryId` CRUD) both under `/timetable`, and `meTimetableRouter` under `/me/timetable`. `timetableOverridesRouter` mounts earlier under `/timetable/overrides` so prefix matching never collides with `/:entryId`.

## D-037 — `timetable.change` notifications go in-app + email only (no WhatsApp)
**Date:** 2026-04-21
**Why:** BRD §6.1 restricts WhatsApp to Fee Due / Payment Received / Ticket Updated; PRD US-TT-05 says "WhatsApp optional, off by default for launch". M4 prompt explicitly forbids WhatsApp for timetable. Including WhatsApp would burn pre-approved-template quota and spam students.
**Source:** BRD §6.1, PRD §8.2 US-TT-05, M4 prompt §5.
**How to apply:** `typeToChannels('timetable.change')` in [api/src/services/notificationService.ts](../api/src/services/notificationService.ts) returns `['inapp', 'email']`. `SpyWhatsAppAdapter.calls` asserted empty in `notificationService.test.ts` and `timetableOverrides.test.ts`.

## D-038 — Timetable stores IST wall-clock; `Override.date`/`Holiday.date` are UTC of IST-midnight
**Date:** 2026-04-21
**Why:** TRD §4.5 specifies `dayOfWeek` + `startTimeMinutes`/`endTimeMinutes` on entries (IST wall-clock, no Date). Overrides and Holidays carry a `date: Date`; to keep day comparisons unambiguous we store `(IST YYYY-MM-DD)T00:00+05:30` → UTC `(YMD)T18:30:00Z`. Day-matching is done via `date-fns-tz` + `Asia/Kolkata`, not via bare UTC slicing.
**Source:** TRD §4.5 + §4.12; CLAUDE.md §5 ("Store UTC in Mongo, display IST").
**How to apply:** `utcDateForIstDay(ymd)` in [api/src/services/timetableTz.ts](../api/src/services/timetableTz.ts) performs the conversion. All writes (seed, createOverride, createHoliday) go through it; reads normalise back via `+330 minutes → toISOString().slice(0,10)` (Holiday) or `istDateStringFromUtc` (Override).

## D-039 — NotificationService is minimal in M4; full template registry lands in M8
**Date:** 2026-04-21
**Why:** CLAUDE.md §4 M8 step 27 scopes the "Email + WhatsApp notification engine (template registry)". M4 only needs `timetable.change` and wants it shippable. Premature template registry would block M4 on cross-milestone design.
**Source:** CLAUDE.md §4 M8.
**How to apply:** Subject/body are rendered inline in `notifyTimetableChange`. `NOTIFICATION_TYPES = ['timetable.change']` starts as a one-element union; M5 extends for fees, M6 for tickets, M8 wires up Resend templates + WABA templates via a registry keyed on `NotificationType`.

## D-040 — `date-fns-tz` added (finally fulfilling CLAUDE.md §5 locked stack)
**Date:** 2026-04-21
**Why:** CLAUDE.md §5 mandates "Use `date-fns-tz`, not Moment." M1–M3 never installed it because no feature required IST rendering. M4 timetable finally needs `Asia/Kolkata` day-of-week + `+05:30` formatting, so the dep is added per spec. Not a `DEPENDENCY_REQUEST.md` — it's in the locked stack.
**Source:** CLAUDE.md §5.
**How to apply:** `date-fns@^3.6.0` and `date-fns-tz@^3.2.0` added to [api/package.json](../api/package.json). Usage confined to [api/src/services/timetableTz.ts](../api/src/services/timetableTz.ts).

## D-041 — Holidays drop the whole IST day after overrides are applied
**Date:** 2026-04-21
**Why:** Spec silent on holiday/override precedence. Practical stance: if a date is a holiday, no class happens — not a rescheduled one, not an added one. A reschedule that *lands on* a holiday must fail (admin responsibility) or the day just disappears from the resolved feed; we pick the latter so the resolver stays pure. This also ensures M8 analytics don't accidentally count class-hours on holidays.
**Source:** PRD §8.3 (resolved) + M4 prompt §3 ("holidays removed").
**How to apply:** [api/src/services/timetableResolutionService.ts](../api/src/services/timetableResolutionService.ts) checks `holidaySet.has(istYmd)` before emitting any recurring entry OR `add`-override for that day.

## D-042 — Seed extended with sample Aviation batch + entries + override + holiday
**Date:** 2026-04-21
**Why:** The M4 DoD curl `GET /v1/timetable?batchId=<seeded>&from=…&to=…` can't be demoed without a seeded batch. The seed stays idempotent via natural keys (`{programId, name}` for Batch, `{batchId, dayOfWeek, startTimeMinutes}` for TimetableEntry, `{batchId, entryId, date}` for Override, `{date}` for Holiday).
**Source:** M4 prompt DoD ("seeded Aviation batch for next 14 days").
**How to apply:** [api/scripts/seed.ts](../api/scripts/seed.ts) now also creates one faculty user, a published `airport-ground-ops` course, one batch, two Mon/Wed entries, one Wed-8-Jul reschedule override, and the 15 Aug 2026 Independence Day holiday.

## D-043 — FeeStructure follows TRD §4.6 components model with optional `weights[]`
**Date:** 2026-04-21
**Why:** M5 prompt proposed "40/30/30 at T0/T+60/T+120" default; TRD §4.6 pins a different model (`components[{kind, cadence: 'one_time' | 'monthly_x', monthlyCount, dueRule}]`). Source-of-truth hierarchy (TRD > PRD > BRD > prompt) resolves to the spec model. Added an optional `weights: number[] | null` field on each component so a monthly_x tuition can split 40/30/30 (largest-remainder allocation) if Logan confirms that need later — additive, not a schema break. Default behaviour is equal split. User confirmed via AskUserQuestion 2026-04-21.
**Source:** TRD §4.6, PRD §9.4, M5 prompt §1.
**How to apply:** [api/src/models/feeStructure.ts](../api/src/models/feeStructure.ts) carries `components[].weights`. [api/src/services/invoiceGenerationService.ts](../api/src/services/invoiceGenerationService.ts) `computeInstallmentAmountsPaise` uses largest-remainder allocation when weights are set. Logged as Q-M5-01.

## D-044 — Payment reversal creates a CreditNote; no separate apply-credit endpoint
**Date:** 2026-04-21
**Why:** TRD §5.6 has `POST /v1/payments/:id/reverse` → CreditNote. It does not define an explicit "apply credit" endpoint, and overpayments on `POST /v1/payments` also produce a CreditNote. M5 prompt asked for `POST /v1/finance/credit-notes/:id/apply` — not in spec, so deferred. `CreditNote.consumed` stays `false` and finance can reference it in payment `notes` when recording the next payment.
**Source:** TRD §5.6, PRD §9.6.
**How to apply:** [api/src/services/paymentService.ts](../api/src/services/paymentService.ts) `reversePayment` creates a CreditNote with `balancePaise === amountPaise`, `consumed: false`. Logged as Q-M5-02.

## D-045 — Admin fees-override endpoint lives on User (not Enrollment)
**Date:** 2026-04-21
**Why:** M5 prompt suggested `PATCH /v1/enrollments/:id/access-state` for the override. TRD §4.1 stores `suspensionOverrideUntil/By` on the User; D-026 stores `accessState` on Enrollment. These are both real — override needs a single grace-window timer per student to avoid "overridden in Aviation but suspended in Retail" splits. Endpoint operates on User and reconciles all active enrolments to `accessState='override'` inside a service transaction. User confirmed via AskUserQuestion 2026-04-21.
**Source:** TRD §4.1, D-026, PRD §9.5 US-FEE-04.
**How to apply:** [api/src/routes/suspensionOverride.ts](../api/src/routes/suspensionOverride.ts) mounts `POST/DELETE /v1/users/:id/suspension/override`. Service in [api/src/services/suspensionService.ts](../api/src/services/suspensionService.ts): `applyOverride`, `revokeOverride`. Audit actions `fees.suspension.override_applied/revoked`. Logged as Q-M5-03.

## D-046 — First cron infra: HMAC-SHA256 over body+timestamp, 5-min replay window
**Date:** 2026-04-21
**Why:** M5 needed signed cron endpoints for Render to invoke (`POST /v1/jobs/fee-reminders`, `POST /v1/jobs/autosuspend`). No cron pattern existed pre-M5. Chose HMAC-SHA256 over `rawBody + x-job-timestamp` with a 5-minute replay guard; secret is `JOB_SECRET` (already prod-guarded via D-020). Timing-safe compare via `crypto.timingSafeEqual`. `express.json({verify})` captures `req.rawBody` so the server verifies exactly the bytes the caller signed. M6 ticket SLA cron + M8 analytics cron reuse the same middleware.
**Source:** TRD §10.1, §14; CLAUDE.md §5.
**How to apply:** [api/src/middleware/requireJobAuth.ts](../api/src/middleware/requireJobAuth.ts) (verify) + `signJobRequest()` helper (sign). Tests cover signed happy path + missing sig + bad sig + stale timestamp.

## D-047 — `clockService.nowUtc()` is the single time source for new code
**Date:** 2026-04-21
**Why:** The fee-reminder cron and auto-suspension state machine both need deterministic time-travel in tests. A central helper (`nowUtc`, `setTestNow`, `advanceTestNow`, `resetClock`) avoids per-service `Date.now()` sprinkles. Tests call `setTestNow(new Date('…'))` and production always gets wall-clock time. Backfill into M1–M4 services is non-blocking (safe to defer).
**Source:** M5 test harness needs.
**How to apply:** All new M5 services import `nowUtc` from [api/src/services/clockService.ts](../api/src/services/clockService.ts). Existing services that currently use `new Date()` are not yet migrated; follow-up during M9 polish is optional.

## D-048 — CloudinaryStorageAdapter goes live in M5 per D-027
**Date:** 2026-04-21
**Why:** D-027 scheduled Cloudinary wiring for M5 receipts. Implemented `upload` via `cloudinary.uploader.upload_stream` (authenticated delivery), `signedUrl` via `cloudinary.utils.private_download_url` (1h TTL), `delete` via `uploader.destroy`, and `signedUploadTicket` via `utils.api_sign_request`. Receipts stored under `il/receipts/<code>.pdf`. Stub mode (default in tests + dev) continues to use `ConsoleStorageAdapter` with in-process byte cache so the receipt download endpoint can stream the PDF without hitting Cloudinary.
**Source:** TRD §9, §12; D-027.
**How to apply:** [api/src/integrations/storageAdapter.ts](../api/src/integrations/storageAdapter.ts) `CloudinaryStorageAdapter` now real. [api/src/routes/receipts.ts](../api/src/routes/receipts.ts) streams the stub cache when `pdfKey.startsWith('stub:')`, otherwise returns a signed URL JSON envelope. Live-mode smoke deferred to M9 (Q-M5-06/Q-PENDING-09).

## D-049 — WhatsApp templates for fees use the two pre-approved WABA templates (D-007)
**Date:** 2026-04-21
**Why:** Only `il_fee_due` and `il_payment_received` are pre-approved at launch (D-007). M5 has 8 `fees.*` notification types; mapping them 1:1 to distinct templates would require 6 more Meta approvals. Instead: `il_fee_due` covers T-7/T0/warn1/warn2/suspended; `il_payment_received` covers `fees.paid`. T-14 and T+3 are email-only per BRD §6.1 (no WhatsApp).
**Source:** BRD §6.1, TRD §9.3, D-007.
**How to apply:** `WABA_TEMPLATE_BY_TYPE` map in [api/src/services/notificationService.ts](../api/src/services/notificationService.ts). WhatsApp dispatch is gated by `WHATSAPP_ENABLED=true` env; default false in dev/test drops the channel silently.

## D-050 — Fees-suspension enforcement lives in `requireAuth`
**Date:** 2026-04-21
**Why:** PRD §9.5 + D-021 require fees-suspended students to retain login but be restricted to /fees, /users/me, /notifications/me, receipts, Finance tickets, and logout. A separate `requireNotSuspended` middleware would need mounting after `requireAuth` in every router (lots of edits) and would only work once `req.auth` is populated. Folding the whitelist check into `requireAuth` itself keeps the enforcement in one place and matches D-021's exemption for fees-suspended sessions at the login wall.
**Source:** PRD §9.5, D-021, M5 review.
**How to apply:** [api/src/middleware/auth.ts](../api/src/middleware/auth.ts) `feesSuspensionAllowed` inline whitelist. `requireNotSuspended` exists as a reserved helper for M6 ticket flow but isn't wired — auth.ts is the single source of truth.

## D-051 — Receipt code resets on Indian financial year (1 Apr)
**Date:** 2026-04-21
**Why:** PRD §9.6 pins receipt code reset to 1 April annually (Indian FY). `financialYearFor(date)` returns the FY by checking IST month ≥ 4. Invoice and Credit Note codes still reset on the calendar year — PRD is silent on them so TRD default (calendar) holds.
**Source:** PRD §9.6.
**How to apply:** [api/src/services/receiptService.ts](../api/src/services/receiptService.ts) `financialYearFor()` drives the counter key for `nextReceiptCode`.
