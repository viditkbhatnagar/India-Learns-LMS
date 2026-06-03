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

## D-052 — Fees-suspension whitelist casing + GET ticket additions
**Date:** 2026-04-22
**Why:** D-050's original `feesSuspensionAllowed` check used `body?.category === 'Finance'` (title case). The canonical category enum locked in at M6 is lowercase (`'finance'`), so the title-case branch would never have fired in production. Plus a fees-suspended student legitimately needs to GET their own ticket thread and comment on finance tickets — those paths were missing from the whitelist.
**Source:** M6 review; TRD §4.7 enum; PRD §9.5 ("raise a Finance-category ticket").
**How to apply:** [api/src/middleware/auth.ts](../api/src/middleware/auth.ts) `feesSuspensionAllowed` now matches `body?.category === 'finance'` (lowercase) and adds allow-list entries for `GET /v1/me/tickets`, `GET /v1/tickets/me`, `GET /v1/tickets/:id`, `POST /v1/tickets/:id/comments`, `POST /v1/tickets/:id/reopen-request`. Covered by [api/tests/integration/tickets.feesSuspension.test.ts](../api/tests/integration/tickets.feesSuspension.test.ts).

## D-053 — Ticket code scheme: `TKT-<PREFIX>-NNNNNN` per-category yearly counter
**Date:** 2026-04-22
**Why:** CLAUDE.md §5 pins the format as `TKT-ACAD-000045`. Splitting the counter per `{year, category}` keeps codes contiguous within a category (so admins reading a backlog don't see holes when another category races ahead). Prefix map: `academic→ACAD, administration→ADMIN, finance→FIN, technical→TECH, complaints→CMPL`. 6-digit width matches the M5 fee-side convention.
**Source:** CLAUDE.md §5; M6 plan.
**How to apply:** [api/src/services/counterService.ts](../api/src/services/counterService.ts) — `TICKET_CATEGORY_PREFIX`, `nextTicketCode(category, year)` writing counter key `ticket_code_${year}_${prefix}`.

## D-054 — Business-day helper on top of M4 Holiday model
**Date:** 2026-04-22
**Why:** PRD §10.4 says 15 business days for Complaints, Mon–Fri, excluding public holidays. M4 already stores Holiday rows as IST-midnight UTC (D-038). The new helper re-uses them instead of introducing a second holiday list. Keyed by IST-YMD via `istDateStringFromUtc` so day comparisons are unambiguous.
**Source:** PRD §10.4; D-038.
**How to apply:** [api/src/services/businessDayService.ts](../api/src/services/businessDayService.ts) — `isBusinessDay`, `loadHolidaySet`, `addBusinessDays`, `addBusinessDaysWithLoad`. `addBusinessDaysWithLoad(n)` loads a `[now, now + n + 30 days]` holiday window — comfortable buffer past the 15 BD worst case.

## D-055 — SLA cron idempotency via atomic boolean flip
**Date:** 2026-04-22
**Why:** The PRD §10.4 breach rule is "notify assignee + admin once per threshold". A naive "if deadline < now, fire" would re-fire on every 30-minute cron tick. The flip uses `Ticket.updateOne({_id, slaAckBreached: false, firstAckAt: null}, { $set: {...} })` — the guard ensures at most one cron invocation sees `modifiedCount > 0` and emits audit + notification. Resolve breach uses the analogous guard on `slaResolveBreached: false`.
**Source:** PRD §10.4; TRD §10.1.
**How to apply:** [api/src/services/slaService.ts](../api/src/services/slaService.ts) `computeBreaches()`. Deterministic under time-travel — verified in [api/tests/unit/slaService.test.ts](../api/tests/unit/slaService.test.ts) "idempotent on a second run".

## D-056 — Routing uses existing `User.deptTag`; no schema extension needed
**Date:** 2026-04-22
**Why:** The M6 plan flagged `deptTag` as an open question (Q-M6-01) assuming the User schema didn't have it. Re-reading [api/src/models/user.ts](../api/src/models/user.ts) found `deptTag: DeptTag | null` already present (shipped with M2 scaffolding). Routing for `administration`/`technical` now prefers `role:admin` with `deptTag='operations'`/`'it'` and falls back to any active admin if the preferred bucket is empty. Complaints → all active superadmins (whole pool notified, first ID assigned).
**Source:** PRD §10.1; existing User schema.
**How to apply:** [api/src/services/ticketRoutingService.ts](../api/src/services/ticketRoutingService.ts). Round-robin within a role bucket uses `counterService.nextRoutingSlot(bucket)` keyed by `ticket_rr_${bucket}`; candidates are sorted by ObjectId then indexed modulo count, so the distribution is deterministic and testable.

## D-057 — `REOPEN_WINDOW_EXPIRED` is additive to spec's `TICKET_STATE_INVALID`
**Date:** 2026-04-22
**Why:** TRD §8 lists only `TICKET_STATE_INVALID` (409) for illegal ticket transitions, which is generic. The milestone prompt requested a more specific `REOPEN_WINDOW_EXPIRED` so the UI can render a dedicated "7-day window has passed" message. Adding both is additive — `TICKET_STATE_INVALID` still fires on other illegal edges (e.g. `open → closed`), and the reopen path specifically throws the new code when the 7-day cliff is hit. No spec violation, just an extra error code.
**Source:** TRD §8 + M6 prompt.
**How to apply:** [api/src/services/ticketService.ts](../api/src/services/ticketService.ts) `transitionTicket` (via the reopen transition) and `reopenTicket` throw `HttpError(409, 'REOPEN_WINDOW_EXPIRED', ...)`. Illegal edges throw `TICKET_STATE_INVALID`. Both are covered in [api/tests/integration/tickets.reopen.test.ts](../api/tests/integration/tickets.reopen.test.ts) and [api/tests/unit/ticketService.test.ts](../api/tests/unit/ticketService.test.ts).

## D-058 — Student reopen creates a child ticket; staff reopen re-opens the parent
**Date:** 2026-04-22
**Why:** The milestone prompt asked for student-only reopen, but PRD §10.2 is explicit: "only **staff** can reopen, and only within **7 days** ... Students can **request** reopen from a closed ticket — that creates a new child ticket linked to the parent; original stays closed." Per CLAUDE.md §2 the spec wins. Both endpoints ship: `POST /v1/tickets/:id/reopen` (staff) actually flips the parent state, `POST /v1/tickets/:id/reopen-request` (student) creates a new `Ticket` with `parentTicketId` pointing at the original.
**Source:** PRD §10.2.
**How to apply:** Two endpoints in [api/src/routes/tickets.ts](../api/src/routes/tickets.ts), two service functions in [api/src/services/ticketService.ts](../api/src/services/ticketService.ts) (`reopenTicket` + `requestReopen`). Student route is `requireRole('student')`; staff route is `requireRole('faculty','finance','admin','superadmin')`.

## D-059 — `/v1/me/tickets` + `/v1/tickets/me` are aliases; `POST` and `PATCH` on `/:id/state` also aliased
**Date:** 2026-04-22
**Why:** TRD §5.7 names `/v1/me/tickets` and `POST /v1/tickets/:id/state`; the M6 prompt used `/v1/tickets/me` and `PATCH`. Per the D-031 alias pattern we mount both so both client contracts work. Zero behavioural risk — same handler, same service.
**Source:** TRD §5.7; M6 prompt; D-031.
**How to apply:** [api/src/routes/index.ts](../api/src/routes/index.ts) mounts `meTicketsRouter` at both `/me/tickets` and `/tickets/me` (the latter BEFORE `/tickets` so Express doesn't swallow `/me` as `/:id`). [api/src/routes/tickets.ts](../api/src/routes/tickets.ts) registers both `POST` and `PATCH` handlers on `/:id/state`.

## D-060 — MCQ grading is all-or-nothing per question
**Date:** 2026-04-22 (M7)
**Why:** Neither TRD §5.9 nor PRD §12 pins partial-credit rules for `mcq_multi`. Vidit confirmed (M7 kickoff AskUserQuestion): chosenIndices set must equal correctIndices set. Any deviation — superset, subset, or wrong single — scores 0. Simplest, least disputable, and matches "tie" edge case being 0. Skipped answers (empty chosenIndices) naturally resolve to 0 via the same rule.
**Source:** PRD §12.3 AC (silent on partial); M7 stakeholder clarification 2026-04-22.
**How to apply:** [api/src/services/assessmentScoring.ts](../api/src/services/assessmentScoring.ts) `gradeMcqAnswers` implements `setsEqual` for multi and `chosen.length===1 && chosen[0]===correctIndices[0]` for single. Covered by [api/tests/unit/assessmentScoring.test.ts](../api/tests/unit/assessmentScoring.test.ts) (happy, "tie", skip-all, wrong-extra, single-multi-pick). If product later requests proportional credit, one `gradeMcqAnswers` branch changes.

## D-061 — Course completion predicate drops "all modules opened"
**Date:** 2026-04-22 (M7)
**Why:** PRD §13.1 phrases completion as "all Modules' content opened + all Quizzes passed + Final Exam passed". But M3 (CLAUDE.md §4 item 11, Logan Q3) deliberately shipped NO watch-time or page-open tracking — there is no `ModuleAccess` or progress collection to observe "opened". M7 simplifies the predicate to "all quizzes passed + at least one passing final-exam attempt". Vidit confirmed at M7 kickoff; flagged Q-M7-01 for Logan to ratify before M9.
**Source:** PRD §13.1; CLAUDE.md §4 M3 item 11 (Logan Q3 decision); M7 AskUserQuestion 2026-04-22.
**How to apply:** [api/src/services/courseCompletionService.ts](../api/src/services/courseCompletionService.ts) `checkAndMaybePublish`. Triggers on quiz `submit` (when passed) and exam `grade` (when graded + passed). Idempotent: second call on already-completed enrolment is a no-op and does not re-publish the event. Covered in [api/tests/unit/courseCompletionService.test.ts](../api/tests/unit/courseCompletionService.test.ts) (exam required, failing quiz blocks, idempotent).

## D-062 — Domain-event pattern: persist + in-process listener registry
**Date:** 2026-04-22 (M7)
**Why:** M7 needs to notify M8 "course completion → Certifier.io issuance" without coupling the two milestones. No queue infra exists (CLAUDE.md §3 "no separate queue infra for Phase 1"). Chose a minimal pattern: `publishDomainEvent(type, payload)` writes a `DomainEvent` row (persistent) AND invokes any listeners `registerListener(type, fn)` registered in-process. M8 will register the Certifier.io listener against `'course.completed'`; in the meantime the event row is evidence that detection works. Listener failures are logged but do NOT fail the publisher — the persisted row is authoritative and a later consumer can sweep unconsumed events.
**Source:** CLAUDE.md §3; PRD §13.1 + §13.2 (certificate idempotency); M7 plan.
**How to apply:** [api/src/services/domainEventService.ts](../api/src/services/domainEventService.ts) + [api/src/models/domainEvent.ts](../api/src/models/domainEvent.ts). Currently only `course.completed` is defined; extend the `DomainEventType` enum in [packages/shared-types/src/enums.ts](../packages/shared-types/src/enums.ts) before adding new event families.

## D-063 — Faculty weekly digest: ungraded essays + stale drafts, 7-day threshold
**Date:** 2026-04-22 (M7)
**Why:** TRD §10.1 schedules `digest-faculty-weekly` at `0 9 * * 1` (Mon 09:00 IST) as a "feedback-coverage email". PRD US-FB-04 also defines coverage as "% of assignments with feedback within 7 days". M7 implements coverage as the union of (a) ExamAttempt rows with `submittedAt < now-7d AND totalScorePercent === null` (ungraded essays) and (b) FeedbackEntry drafts with `createdAt < now-7d AND status === 'draft'`. Grouped per faculty, one email per faculty. Q-M7-03 flags this scoping for Logan confirmation.
**Source:** TRD §10.1 + §7.7; PRD US-FB-04.
**How to apply:** [api/src/services/facultyDigestService.ts](../api/src/services/facultyDigestService.ts) `buildFacultyDigestBuckets` + `runFacultyDigest`. Signed via `requireJobAuth` at [api/src/routes/jobsFacultyDigest.ts](../api/src/routes/jobsFacultyDigest.ts). Render cron line: `0 9 * * 1` in `Asia/Kolkata`; runbook addition pending in M9.

## D-064 — Exam grading replaces the grades[] array (idempotent re-grade)
**Date:** 2026-04-22 (M7)
**Why:** Faculty may regrade an essay after student contests a score (via an Academic ticket, per PRD §11.1). Merging grades by questionIndex invites drift (stale rubricScores from a prior run). M7 replaces the whole `grades[]` array on each grade call and recomputes `mcqScorePercent`/`essayScorePercent`/`totalScorePercent` from scratch. Safe because the source data (`questions`, `answers`, `essayAnswers`) is immutable post-submit. Regrade's `before`/`after` diff is captured in the `exam.attempt.graded` audit row.
**Source:** Design choice for M7; matches PRD §11.1 one-way feedback model (grade changes are audited, not discussed via comments).
**How to apply:** [api/src/services/gradingService.ts](../api/src/services/gradingService.ts) `gradeExamAttempt`. Unit test "is idempotent: re-grading rewrites" verifies [api/tests/unit/gradingService.test.ts](../api/tests/unit/gradingService.test.ts).

## D-065 — Feedback cannot revert published → draft
**Date:** 2026-04-22 (M7)
**Why:** Published feedback fires an email + in-app notification the student has already seen. Reverting it to draft would be ambiguous: should the notification be "unpublished"? The student has already opened it. Safer rule: published is terminal, edit a draft or create a new entry instead. Throws `409 FEEDBACK_ALREADY_PUBLISHED`.
**Source:** PRD §11.3 ("Drafts don't notify"); M7 design choice.
**How to apply:** [api/src/services/feedbackService.ts](../api/src/services/feedbackService.ts) `updateFeedback`. Tested in [api/tests/unit/feedbackService.test.ts](../api/tests/unit/feedbackService.test.ts).

## D-066 — `/me/feedback` mounts BEFORE `/feedback` (literal segment wins)
**Date:** 2026-04-22 (M7)
**Why:** Same pattern as M6's `/me/tickets` vs `/tickets/:id`. Express matches routers in registration order; if `/feedback` mounts first, `/feedback/me` would route into the `/:id` handler and try to ObjectId-parse "me". Mount literal routes first.
**Source:** D-059 precedent.
**How to apply:** [api/src/routes/index.ts](../api/src/routes/index.ts) — `meFeedbackRouter` at `/me/feedback` mounts immediately before `feedbackRouter` at `/feedback`.

## D-067 — Student-facing quiz/exam DTO strips correctIndices
**Date:** 2026-04-22 (M7)
**Why:** The Mongoose doc's `toJSON` transform doesn't discriminate: it would serialize the full question including `correctIndices`, handing students the answer key during an attempt. `toStudentQuizDto` + `toStudentExamDto` return a narrowed projection (text, kind, options, points, wordLimit only — essay options also stripped). The full shape is reserved for faculty/admin.
**Source:** Obvious security requirement.
**How to apply:** [api/src/services/quizService.ts](../api/src/services/quizService.ts) + [api/src/services/examService.ts](../api/src/services/examService.ts); used by `GET /v1/quizzes/:id` and `GET /v1/exams/:id` when `auth.role === 'student'`.

## D-068 — `GET /v1/feedback/:id` role gate + service-level default-deny
**Date:** 2026-04-22 (M7 security review)
**Why:** First-pass M7 mounted `GET /v1/feedback/:id` under `requireAuth` only, relying on in-service role branches (`student` owner + published, `faculty` course ownership). The branches had no default-deny, so any other authenticated role — notably `finance` — fell through and received the full `FeedbackEntryDto` (including drafts). Security review filtered this to confidence 9/10. Fix is twofold: gate the route with `requireRole('student','faculty','admin','superadmin')` to match every sibling route on the same router, and add an explicit `else throw 403` in `getFeedback` so the service is defence-in-depth safe if a future route forgets the middleware. DPDP Act 2023 purpose-limitation reinforces this: feedback narratives are collected for academic review, not finance access.
**Source:** M7 security-review skill, 2026-04-22.
**How to apply:** [api/src/routes/feedback.ts](../api/src/routes/feedback.ts) `GET /:id` carries `requireRole('student','faculty','admin','superadmin')`. [api/src/services/feedbackService.ts](../api/src/services/feedbackService.ts) `getFeedback` ends with `else if (actor.role !== 'admin' && actor.role !== 'superadmin') throw new HttpError(403, 'FORBIDDEN', ...)`. Regression test in [api/tests/integration/feedback.test.ts](../api/tests/integration/feedback.test.ts) "finance role cannot read feedback via GET /v1/feedback/:id" verifies 403 on both draft and published entries and asserts the narrative summary does not leak in the error body.

## D-069 — Inline dispatch + retry sweep cron (not queue drain)
**Date:** 2026-04-22 (M8)
**Why:** PROMPTS.md M8 prompt describes a "worker cron every minute drains the queue, dispatches via adapters, marks sent/failed with retry (3 attempts, exponential backoff)". TRD §9.2 instead specifies **inline Resend→SendGrid fallback (one retry)**, and TRD §10.1 lists no notifications-dispatch cron. Per spec hierarchy (TRD > PRD > BRD > UI/UX > PROMPTS), TRD wins. We keep M4–M7's inline dispatch in `enqueueNotification` and add a lightweight `/v1/jobs/notifications-retry` sweep (every 15 min) that retries any notification where `emailError != null && emailSentAt == null && retryCount < 3` with exponential backoff (`60s * 2^retryCount` between attempts, capped by `NOTIFICATIONS_RETRY_MAX` and `NOTIFICATIONS_RETRY_WINDOW_HOURS`). This satisfies the PROMPTS retry intent without breaking the TRD schedule or rewriting the inline dispatch.
**Source:** TRD §9.2, §10.1. User choice 2026-04-22.
**How to apply:** [api/src/services/notificationService.ts](../api/src/services/notificationService.ts) `retryFailedNotifications`. [api/src/jobs/notificationsRetryJob.ts](../api/src/jobs/notificationsRetryJob.ts). Route `POST /v1/jobs/notifications-retry` in [api/src/routes/jobsNotifications.ts](../api/src/routes/jobsNotifications.ts). Render cron config pending M9 `render.yaml` — documented here so it doesn't get lost.

## D-070 — Internal ApiCostLedger + configurable paise rates
**Date:** 2026-04-22 (M8)
**Why:** PRD §15 requires an admin api-cost widget and says "read from provider APIs where available; otherwise record usage counters internally and multiply by known rates". TRD does not specify the actual rates. We record one `ApiCostLedger` row per adapter call with the provider, operation, units, and a snapshot of `unitPaise` at write time (so historical aggregates stay stable when rates are reconciled against real invoices). Rates are env-configurable: `EMAIL_UNIT_PAISE=50`, `WHATSAPP_UNIT_PAISE=200`, `STORAGE_UNIT_PAISE=5`, `CERTIFIER_UNIT_PAISE=2500` — India-typical estimates queued for Logan confirmation as Q-M8-01.
**Source:** PRD §15, BRD BR-13, user choice 2026-04-22.
**How to apply:** [api/src/models/apiCostLedger.ts](../api/src/models/apiCostLedger.ts) + [api/src/services/apiCostService.ts](../api/src/services/apiCostService.ts) `recordApiCost`. Hooks in `notificationService` (email primary / email fallback / whatsapp) and `certificateService` (`certifier.issue`). Consumed by `analyticsService.getAnalyticsSummary().apiCost`.

## D-071 — Auto-issue on course.completed + admin retry via POST
**Date:** 2026-04-22 (M8)
**Why:** PRD §13.1 wording is admin-triggered ("Admin can Issue Certificate from the Enrolment detail page"), but PROMPTS.md M8 prompt says "Listen for courseCompleted events → call adapter.issue". Both make sense: the listener auto-issues in the happy path; the admin POST is the retry button for the PRD §13.2 "If Certifier fails, the UI surfaces a clear error and a Retry button." Listener registers via `registerCertificateListener()` at app boot (single-flight guarded so tests don't stack listeners); `POST /v1/enrollments/:id/issue-certificate` is idempotent — if `enrollment.certificateUrl` is set, it returns `{reissued: true}` without touching the adapter.
**Source:** PRD §13.1, §13.2; PROMPTS.md Prompt 7; user choice 2026-04-22.
**How to apply:** [api/src/services/certificateService.ts](../api/src/services/certificateService.ts) `issueForEnrollment({actor})`, `registerCertificateListener()`. Wired in [api/src/index.ts](../api/src/index.ts) before server listen. Adapter interface [packages/shared-types/src/integrations.ts](../packages/shared-types/src/integrations.ts) `CertificateAdapter`. Stub + live in [api/src/integrations/certificateAdapter.ts](../api/src/integrations/certificateAdapter.ts).

## D-072 — TRD §5.11 `/me/notifications` + `/me/notification-prefs` mounted alongside M4 `/notifications/me` alias
**Date:** 2026-04-22 (M8)
**Why:** TRD §5.11 specifies `GET /v1/me/notifications`, `POST /v1/me/notifications/:id/read`, `GET/PATCH /v1/me/notification-prefs`. Existing M4 code mounted at `/v1/notifications/me` (wrong but in the wild across M4–M7 tests and the seed). Rather than rewrite, M8 mounts the TRD paths as new router while keeping M4's alias working — identical pattern to M6's dual mount of `/v1/me/tickets` + `/v1/tickets/me` (D-031). The new `meNotificationsAliasRouter` handles the TRD paths; the existing `notificationsRouter` at `/notifications` stays untouched.
**Source:** TRD §5.11. D-031 precedent.
**How to apply:** [api/src/routes/notificationPrefs.ts](../api/src/routes/notificationPrefs.ts) exports both `meNotificationsAliasRouter()` and `notificationPrefsRouter()`. Mounted at `/me/notifications` and `/me/notification-prefs` in [api/src/routes/index.ts](../api/src/routes/index.ts).

## D-073 — NotificationPrefs uses `Schema.Types.Mixed`, not Mongoose `Map<Boolean>`
**Date:** 2026-04-22 (M8)
**Why:** Initial M8 implementation used `Map` with `of: Boolean`. Mongoose's Map casting is brittle across versions for Boolean-valued maps — both `new Map()` and plain `{}` initializers triggered "Cast to Map failed" validation errors in integration tests. Service layer already owns validation (keys vs `NOTIFICATION_TYPES`, WhatsApp allowlist) so Mixed is a cleaner fit. `updatePrefsForUser` copies the object, mutates, then `markModified('emailByType')` to notify Mongoose of the deep change.
**Source:** 2026-04-22 failing test diagnosis.
**How to apply:** [api/src/models/notificationPrefs.ts](../api/src/models/notificationPrefs.ts) uses `Schema.Types.Mixed`. [api/src/services/notificationPrefsService.ts](../api/src/services/notificationPrefsService.ts) reads + writes plain objects.

## D-074 — Web port: react-query + zustand + axios + recharts + tailwind
**Date:** 2026-04-22 (M8 UI backlog drain)
**Why:** PROMPTS.md M8/M9 implied full UI build but didn't lock the client stack. TRD §3 lists React 18 + Vite 5 + Tailwind 3 + `vite-plugin-pwa` + `zustand` (already) + `recharts` (for dashboard charts). Chose: axios for HTTP (rich interceptors for 401 refresh), @tanstack/react-query 5 for server state (query invalidation matches our mutation flow), zustand 4 with `persist` for auth session, react-hook-form for the bigger forms (optional). No css-in-js — keep Tailwind utility classes throughout. Poppins self-hosted (DPDP-friendly per Prompt 8 line 413); for M8 we use the system fallback until the webfont is committed.
**Source:** TRD §3.1, §3.3, TRD line 254 (recharts).
**How to apply:** `web/package.json` deps. [web/src/lib/api.ts](../web/src/lib/api.ts) axios + 401 refresh. [web/src/store/auth.ts](../web/src/store/auth.ts) zustand persist. [web/src/lib/endpoints.ts](../web/src/lib/endpoints.ts) typed per-domain wrappers.

## D-075 — Port approved JSX mockups, do not redesign
**Date:** 2026-04-22 (M8 UI)
**Why:** Root `/CLAUDE.md` §2 "Existing design assets you must consume (not rewrite)" binds every UI decision. The approved mockups in `webapp/` and `mobile/` are the source of truth for brand palette, component shapes, and screen layouts. M8 ports them into Tailwind components (Button, Card, Input, Badge, Skeleton, EmptyState, ErrorBoundary, NotificationBell, AppShell) and wires them to live APIs. Pixel-perfect match is a polish concern that slips to M9; M8's bar is: wired, functional, brand-consistent, mobile + desktop breakpoints honoured.
**Source:** root CLAUDE.md §2.
**How to apply:** Components in [web/src/components/ui/](../web/src/components/ui/) and [web/src/components/AppShell.tsx](../web/src/components/AppShell.tsx) mirror the webapp/styles.css design tokens. Routes covered: auth (login/forgot/reset/accept-invite), student (dashboard/courses/timetable/fees/tickets/feedback/certificates/profile/notification-prefs), admin (dashboard/users/programs/courses/tickets + placeholders for deeper CRUD), finance (dashboard/payments/new/payments-list placeholder), faculty (dashboard + placeholders). Deeper admin/finance/faculty CRUD and quiz/exam attempt screens ship in M9 polish.

## D-076 — Email primary expanded to {Resend, SendGrid, Brevo}; SendGrid is implicit fallback
**Date:** 2026-04-22 (M9)
**Why:** TRD §9.2 named Resend primary + SendGrid fallback. User decision 2026-04-22 added Brevo (formerly Sendinblue) as a third primary option ("will use brevo to send emails, or just put keys for now"). All three adapters are wired via fetch + 10s timeout, no per-provider SDKs (matches the M8 `CertifierIoAdapter` style — keeps the dep list tight). The integrations factory keeps the M8 fallback semantics: when the primary is anything other than SendGrid AND `SENDGRID_API_KEY` is set, the SendGrid adapter is wired in as the fallback, and `notificationService.sendEmailWithFallback` writes the dual cost-ledger rows on a fallback win. Stub mode (default in dev/test) still bypasses all adapters via the Console adapter.
**Source:** TRD §9.2; user choice 2026-04-22.
**How to apply:** [api/src/integrations/emailAdapter.ts](../api/src/integrations/emailAdapter.ts) — `ResendEmailAdapter`, `SendGridEmailAdapter`, `BrevoEmailAdapter` all live (no more `throw 'not wired'`). [api/src/integrations/index.ts](../api/src/integrations/index.ts) factory selects on `EMAIL_PROVIDER` (added `'brevo'` to the enum) and wires SendGrid as fallback for non-SendGrid primaries. Env schema in [api/src/config/env.ts](../api/src/config/env.ts) adds `BREVO_API_KEY`. Unit tests in [api/tests/unit/emailAdapter.test.ts](../api/tests/unit/emailAdapter.test.ts) mock global fetch and assert URL, headers, and body shape per provider.

## D-077 — Sentry no-op when DSN absent (server + web)
**Date:** 2026-04-22 (M9)
**Why:** Runbook §7 calls for Sentry. The dev/test environment must require zero extra config to run, so Sentry init is gated on `SENTRY_DSN` (server) / `VITE_SENTRY_DSN` (web). Both `initSentry()` returns `false` when the DSN is empty and `captureException()` is a no-op. Server `errorHandler` invokes `captureException` for any non-`HttpError` 500 (i.e. truly unexpected errors); status < 500 is filtered out at the helper to avoid noisy operator-meaningful errors. Web: `ErrorBoundary.componentDidCatch` calls `captureException`. No `@sentry/profiling-node` (extra setup, post-launch concern); `tracesSampleRate=0.1` default keeps perf-trace volume modest.
**Source:** Runbook §7; CLAUDE.md §3 ("validate env on boot with zod").
**How to apply:** [api/src/config/sentry.ts](../api/src/config/sentry.ts), wired in [api/src/app.ts](../api/src/app.ts) + [api/src/middleware/error.ts](../api/src/middleware/error.ts). [web/src/lib/sentry.ts](../web/src/lib/sentry.ts), wired in [web/src/main.tsx](../web/src/main.tsx) + [web/src/components/ui/States.tsx](../web/src/components/ui/States.tsx).

## D-078 — `/healthz` mounted as alias of `/health` (Render + uptime probes)
**Date:** 2026-04-22 (M9)
**Why:** TRD §14 calls for `/healthz` + `/readyz`. Existing `GET /health` (M1, D-002) returns the right payload. Adding `/healthz` as an alias of the same handler matches Render's default health probe path and BetterStack's expectations without breaking the M1 `/health` contract. `/readyz` not added — `/healthz` doubles as ready in practice (the app only routes when DB connection is up; that's verified by the v1 router mount).
**Source:** TRD §14; Runbook §3.1 health-check path.
**How to apply:** [api/src/app.ts](../api/src/app.ts) registers the same handler at `/health` and `/healthz`. Test in [api/tests/health.test.ts](../api/tests/health.test.ts).

## D-079 — `scripts/sign-job-jwt.mjs` is HMAC, not JWT (filename retained for traceability)
**Date:** 2026-04-22 (M9)
**Why:** Plan filename is `sign-job-jwt.ts` per CLAUDE.md milestone refs. The actual signing scheme on the server (`api/src/middleware/requireJobAuth.ts`) is HMAC-SHA256 over `rawBody + timestamp` carried in `x-job-signature` + `x-job-timestamp` headers — not a JWT. Filename retained so milestone planning + TASKS stay searchable; implementation matches the deployed verifier. Written as `.mjs` (pure Node ESM) so Render cron can `node scripts/sign-job-jwt.mjs <jobName>` without needing `tsx` in the runtime image — keeps cron containers small and fast.
**Source:** Existing requireJobAuth contract; M9 plan.
**How to apply:** [scripts/sign-job-jwt.mjs](../scripts/sign-job-jwt.mjs). Five `JOB_PATHS` mapped: fee-reminders, autosuspend, sla-timers, digest-faculty-weekly, notifications-retry. Reads `API_ORIGIN` + `JOB_SECRET` from env; exits non-zero on any HTTP non-2xx. Each cron in [render.yaml](../render.yaml) invokes `node scripts/sign-job-jwt.mjs <jobName>`.

## D-080 — vite-plugin-pwa SW registration is via workbox-window (not auto)
**Date:** 2026-04-22 (M9)
**Why:** vite-plugin-pwa supports `injectRegister: 'auto'` for one-line registration, but that ships a basic registration without an `update-ready` hook. We want an in-app "A new version is ready · Refresh" banner so users notice deploys. `workbox-window`'s `Workbox` class exposes a `'waiting'` event that we re-dispatch as a window-level `'sw:update-ready'` event; `ServiceWorkerUpdateBanner` listens and surfaces a banner. SW registration is suppressed in dev (`import.meta.env.DEV`) and bypassable via `VITE_ENABLE_PWA=false`.
**Source:** Runbook §7; UI/UX §9 PWA spec.
**How to apply:** [web/src/lib/registerSW.ts](../web/src/lib/registerSW.ts) (workbox-window). [web/src/components/InstallPrompt.tsx](../web/src/components/InstallPrompt.tsx) exports both `InstallPrompt` (mobile install banner) and `ServiceWorkerUpdateBanner`. [web/vite.config.ts](../web/vite.config.ts) keeps `injectRegister: false` and adds workbox `runtimeCaching` (NetworkFirst for /me/* JSON, CacheFirst for Cloudinary media) + `navigateFallback: '/offline.html'`.

## D-081 — Mobile screens are responsive Tailwind, not separate JSX ports
**Date:** 2026-04-22 (M9)
**Why:** Mobile `mockups in `mobile/screens-mobile.jsx` (15 screens) describe the same routes as the desktop screens with mobile-specific layouts (single-column, bottom tabs, native-feel headers). Rather than maintain two route trees, every page is built responsive-first against Tailwind breakpoints (`< md` is mobile, `≥ md` is desktop). The one mobile-only addition is `MobileBottomTabs` (visible only `< md` via Tailwind) per role. AppShell adds bottom padding (`pb-24 md:pb-6`) so content isn't hidden by the tab bar. All 30+ pages render acceptably at 375 × 812 by virtue of the responsive primitives — verified by the screenshot Playwright spec running at the iPhone SE viewport.
**Source:** UI/UX §5 breakpoints; Plan Part A.
**How to apply:** [web/src/components/mobile/BottomTabs.tsx](../web/src/components/mobile/BottomTabs.tsx) + [web/src/components/AppShell.tsx](../web/src/components/AppShell.tsx) (renders `<MobileBottomTabs />` after the main grid, plus the `pb-24 md:pb-6` padding). All page components use Tailwind responsive utilities; no per-platform forks.

## D-082 — Onboarding screens are public + static (real account creation lives in /accept-invite)
**Date:** 2026-04-22 (M9)
**Why:** The onboarding mockups in `webapp/screens-extras.jsx` are marketing-style step-by-steps. The real account creation UX is `/accept-invite?t=<token>` (M2, AcceptInvitePage) which actually POSTs to `/auth/invite/accept`. Mounting the 5 onboarding pages as static routes that link forward to `/accept-invite` keeps the visual brand pitch from the mockups while routing real users through the secure token flow. Setting password on the static `/onboarding/set-password` page is intentionally a CTA to "I have an invite token → /accept-invite" (no real password set on a route that doesn't have a token). This avoids a mockup-vs-spec contradiction without losing the brand walk-through.
**Source:** webapp/screens-extras.jsx mockups; M2 acceptInvite contract.
**How to apply:** [web/src/pages/onboarding/Onboarding.tsx](../web/src/pages/onboarding/Onboarding.tsx) — five exported components. [web/src/App.tsx](../web/src/App.tsx) mounts them at `/onboarding/*` outside any `RequireAuth` guard. `OnbSetPasswordPage` links to `/accept-invite` instead of presenting a real form.

## D-083 — Eslint react/no-unescaped-entities + consistent-return + no-shadow disabled for web
**Date:** 2026-04-22 (M9)
**Why:** `react/no-unescaped-entities` catches no real bugs and forces `&apos;` everywhere — noisy for India Learns copy that uses contractions. `consistent-return` misfires on `useEffect` cleanups (early `return` vs `return () => …`). `no-shadow` collides with idiomatic readable code where outer `q` (query) and inner `q` (question) coexist. All three disabled at the eslint config web-workspace block; airbnb-base remains everywhere else. Also upgraded `eslint-plugin-react-hooks` to v5.2.0 (the v4 release crashed on `useMemo`/`useEffect` analysis under ESLint 9 — `context.getSource is not a function`).
**Source:** Lint failures during M9 screen work, 2026-04-22.
**How to apply:** [eslint.config.js](../eslint.config.js) web block adds the three rule-off entries. Root + web both pin `^5.2.0` of `eslint-plugin-react-hooks`. `scripts/**`, `web/playwright.config.*`, `web/e2e/**` added to ignores so the cron script's intentional `console.error` and Playwright's helper config don't trip airbnb's rules.

## D-084 — Pre-launch verification outcome + Atlas cluster provisioned + seed-demo shipped
**Date:** 2026-04-22 (pre-launch verification session)
**Why:** First end-to-end verification against a real Atlas cluster after M9 artifact landing. Captures: (1) what verified green, (2) what verified red and will block launch, (3) the demo-seed addition.
**Source:** [docs/smoke/findings/2026-04-22-pre-launch.md](../docs/smoke/findings/2026-04-22-pre-launch.md); session prompt.
**How to apply:**
- **MongoDB Atlas cluster:** `dev.gdddmth.mongodb.net`, user `agi_admin`, db `india_learns`. ⚠️ region not yet verified against BRD BR-11 (must be AWS ap-south-1). Flagged under Q-VERIFY-02 (new).
- **Seed augmentation:** [api/scripts/seed-demo.ts](../api/scripts/seed-demo.ts) + `npm run seed:demo -w api` added — idempotent, creates 2 batches (one per program, next-Monday IST start), a 40/30/30 FeeStructure with `weights=[40,30,30]` (Q-M5-01 pragmatic answer), 3 demo students `IL-2026-0101/0102/0103`, invoices, first-installment-shifted-to-T+7 for cron exercise, 2 holidays in the next 30 days. Coexists with the existing `seed.ts` (which uses codes `IL-2026-0001`) by claiming the 0101+ range.
- **Verified green:** lint (0), typecheck (0), test (409/409), coverage (82.52% lines on services/), build (sw.js + manifest.webmanifest emitted), `mongo connected`, `/health` + `/healthz`, seed idempotency.
- **Verified red — launch blocker Q-VERIFY-01:** Playwright 3/32. Web `authApi.login` in `web/src/lib/endpoints.ts` posts `{email, password}` only; server requires `deviceId: min(1).max(128)` per `api/src/routes/auth.ts:20`. Same gap on `/auth/invite/accept` + `/auth/refresh`. Fixing Q-M2-01 (UUIDv4 in localStorage) unblocks the entire authenticated test surface. Until then, the M9 memory claim "Playwright auth + role routing passes" is aspirational — the test suite was never exercised end-to-end against a real browser before this session.
- **Verified amber — Lighthouse:** `/student/dashboard` redirects to `/login` anonymously, so scores reflect login page: perf 55 / a11y 94 / bp 100 / seo 82. v1.1 bundle-split (recharts + sentry) + login-page SEO meta tags will push perf + seo over 90.
- **Verified amber — rate-limit in-memory store (Q-M2-03):** `LOGIN_RATE_MAX=5` tripped within the first Playwright run. For verification sessions we set `RATE_LIMITS_DISABLED=true` in `api/.env`; prod Render must re-enable and add `rate-limit-redis` if scaling beyond 1 instance.

## D-085 — deviceId on web is UUIDv4 persisted in `localStorage['il:deviceId']` (closes Q-M2-01 + Q-VERIFY-01)
**Date:** 2026-04-22 (pre-launch verification, same session as D-084)
**Why:** Q-VERIFY-01 exposed that no browser has ever successfully logged into the live app — the web client never included `deviceId`, which the API requires on `/auth/login`, `/auth/invite/accept`, and optionally on `/auth/refresh`. The Q-M2-01 plan ("UUIDv4 in localStorage") was always the right answer; this session finally ships it. `localStorage` is the right home because the deviceId is a stable per-browser identifier that outlives the access token — perfect for the server's RefreshToken audit trail (which is the only thing that actually reads it).
**Source:** Q-M2-01 + Q-VERIFY-01; TRD §7 auth model.
**How to apply:**
- [web/src/lib/deviceId.ts](../web/src/lib/deviceId.ts) — `getDeviceId()` lazy-generates once via `crypto.randomUUID()` and persists; falls back to `dev-<timestamp>-<rand>` if `crypto.randomUUID` or `localStorage` is unavailable (old browsers, incognito lockdowns).
- [web/src/lib/endpoints.ts](../web/src/lib/endpoints.ts) — `authApi.login` and `authApi.acceptInvite` now include `deviceId: getDeviceId()` in the POST body.
- [web/src/lib/api.ts](../web/src/lib/api.ts) — the 401-refresh interceptor also sends `{ deviceId }` in the body (optional on server-side, but preserves audit continuity across refreshes).
- Playwright now 12/32 green (was 3/32); remaining 20 are Q-VERIFY-03 color-contrast (17) + Q-VERIFY-04 UI-label drift (3). Proves the fix and proves auth, role routing, and screenshot capture are real-browser-functional.
- The server never validates the format (stays opaque `min(1).max(128)`), so UUIDv4 is policy, not enforcement. If we ever want to tighten, the validator is a 1-line change in `api/src/routes/auth.ts`.

## D-087 — Official logo wired + LUC dropped from user-facing copy
**Date:** 2026-04-22 (pre-launch verification, operator signal)
**Why:** Operator confirmed brand name is "India Learns" (closes Q-M1-01) and delivered the official logo JPEG (closes Q-PENDING-01) plus explicit instruction: "don't mention LUC anywhere, just India Learns." Session swap: app now ships the operator's logo across AppShell header, LoginPage, and onboarding BrandHeader; PWA icons (192/512 PNG + 180 apple-touch + 32 favicon) generated via `sips` from the same source jpeg; index.html + manifest description updated (also added a `<meta name="description">` which bumps the prior login-page SEO score toward the 90 gate); all "LUC" mentions removed from UI copy, onboarding flow, login subtitle/footer copyright, seed program descriptions, receipt org name, and the seed test fixture. LUC references remain only in `claude-code-docs/**` (original authored spec pack — not user-facing) and `memory/**` (internal team context).
**Source:** Operator messages 2026-04-22.
**How to apply:**
- Logo at [web/public/brand/logo.jpg](../web/public/brand/logo.jpg); PWA icons at [web/public/icons/icon-{192,512}.png](../web/public/icons/icon-192.png) + apple-touch-icon.png; favicon at [web/public/favicon.png](../web/public/favicon.png).
- UI refs: [web/src/components/AppShell.tsx](../web/src/components/AppShell.tsx) (header), [web/src/pages/auth/LoginPage.tsx](../web/src/pages/auth/LoginPage.tsx) (login splash), [web/src/pages/onboarding/Onboarding.tsx](../web/src/pages/onboarding/Onboarding.tsx) (BrandHeader).
- Removed stale assets: `logo-placeholder.svg`, `icon-192.svg`, `icon-512.svg`, `icon-maskable.svg`, `favicon.svg`.
- Root CLAUDE.md §9 suggested footer copy was `© 2026 LUC / India Learns.` — overridden by operator to `© 2026 India Learns.`
- Receipt org name env default flipped from `India Learns (LUC)` → `India Learns` in [api/src/config/env.ts](../api/src/config/env.ts) + `.env.example` + dev `.env`.

## D-086 — Product-call sweep on 2026-04-22 pre-launch session (13 open questions closed)
**Date:** 2026-04-22 (pre-launch verification, same session as D-084/D-085)
**Why:** User delegated product-call decision-making for this session. Closed 13 open questions where the decision was low-risk and well-supported by the spec pack. Each decision is recorded inline in [open-questions.md](open-questions.md) with a `**CLOSED 2026-04-22 (pre-launch)**` header + rationale. Summary:
- **Q-M2-01** (deviceId) — UUIDv4 in localStorage (shipped, D-085).
- **Q-M2-03** (rate-limit store) — in-memory stays for Phase 1 (1 Render instance).
- **Q-M2-04** (`__Host-il_rt` cookie Path) — keep `Path=/` (security-positive).
- **Q-M3-02** (batch status transitions) — admin-driven, no state machine in Phase 1.
- **Q-M3-03** (module deletion with audit rows) — allow soft-delete; preserve audit rows.
- **Q-M4-02** (faculty timetable filter) — keep literal `facultyId === self`.
- **Q-M4-04** (room overlap scope) — keep cross-batch (stricter reading).
- **Q-M5-01** (weights[] 40/30/30) — default for new structures via seed-demo; equal split remains the model default.
- **Q-M5-03** (suspension override cap) — no hard cap; UI defaults picker to now+30d.
- **Q-M5-04** (reversal window) — 24h confirmed.
- **Q-M5-05** (autosuspend cron weekend carve-out) — no carve-out; fires daily including weekends.
- **Q-M6-02** (manager CC) — "any active admin" for Phase 1.
- **Q-M6-04** (SLA re-arm on reopen) — sticky breach; student-initiated reopens already spawn a child ticket with fresh SLA.
- **Q-M7-01** (course completion) — simplified predicate (quizzes + exam) final; no mark-opened endpoint.
- **Q-M7-03** (faculty digest scope) — keep both ungraded essays + stale drafts in one digest.
- **Q-M7-04** (exam "Graded" state) — keep 4 states; grading completeness is per-attempt.
**Source:** Open questions in memory/open-questions.md; spec pack deltas.
**How to apply:** No code changes required for any of these (each was already the de-facto behaviour — the closure just promotes it from "maybe change" to "this is the policy"). Documentation cleanup in TRD/PRD is queued for the next doc-pack revision pass.

## D-088 — UI polish pass: impeccable-audit remediation
**Date:** 2026-04-24
**Why:** UI audit against the `impeccable` skill's quality rules found several AI-slop patterns that had drifted in during implementation but are NOT in the approved mockups (`webapp/` + `mobile/`). Cross-referenced each finding against the mockups before touching anything.

**Changes (all restore the approved mockup or are mechanical refactors — no brand-identity changes):**

1. **Removed 4px left-stripe accents** from 5 StatTile variants (student/faculty/admin/finance dashboards + finance-payment summary). Mockups use only 1px neutral dividers, never colored side-stripes. Tone is now conveyed by the big-number text color, not a bar.
2. **Removed decorative `backdrop-blur-sm` glassmorphism** from 4 student pages (dashboard next-class widget, certificate medallion, quiz/exam completion circles). Mockups have zero backdrop-blur. Kept the two *functional* blurs in AppShell (sidebar scroll translucency, modal overlay dim).
3. **Restored Poppins + JetBrains Mono font pair** per [webapp/styles.css:39](webapp/styles.css#L39). Added `@fontsource/jetbrains-mono` (weights 400/500/700), added `mono` to Tailwind `fontFamily`, applied `font-mono tabular-nums` at all mockup call sites: stat values, ticket/receipt/invoice/student codes, timetable times, module-number badges, quiz/exam timers, fee amounts.
4. **Renamed `ease-bounce` → `ease-decel`** in tailwind config + ~6 component usages. The curve `cubic-bezier(0.22, 1, 0.36, 1)` is ease-out-quint (no overshoot, compliant) — the old name invited future contributors to think overshoot was sanctioned.
5. **Capped body-text prose at `max-w-[68ch]`** on ticket threads, announcements, feedback comments, faculty essay/submission bodies, admin ticket detail. Previously unbounded on a 1400px shell.
6. **Split the three monolithic `*Screens.tsx` files** into per-route files (22 new files across `pages/admin/`, `pages/faculty/`, `pages/finance/`). AdminScreens (941 LOC), FacultyScreens (1014 LOC), FinanceScreens (416 LOC) deleted. Brought the project in line with [CLAUDE.md §5](CLAUDE.md#L237) "one file per resource" convention.
7. **Migrated navy + orange palette scales to OKLCH** with anchor-preserving strategy: the `500` anchors (`#1A3A8F`, `#F58220`) are kept as exact hex so brand colors render pixel-identical; `50-400` and `600-900` are regenerated in OKLCH for perceptually uniform steps with reduced chroma at scale extremes. Also tinted `surface.DEFAULT` away from pure white toward a barely-perceptible warm off-white (`oklch(0.992 0.005 80)`) so cards sit harmoniously on the cream bg.

**Dropped (intentionally not touching):**
- Differentiating the 4 dashboards — mockups intentionally share the same stat-tile grid across roles. Not a divergence.
- Adding a *display* font beyond Poppins + JetBrains Mono — approved pair is exactly these two; adding a third face would be a brand change requiring Logan/Rejin sign-off.
- The `Card` `accent` top-border prop (border-t-2 orange/navy on hero cards) — approved mockup usage. Only side-stripes were the ban.

**Source:** impeccable skill quality rules (absolute bans, AI-slop test, color + typography + motion rules); cross-referenced against approved mockups in `webapp/` (JSX + styles.css).
**How to apply:** After the OKLCH switch, `npm run typecheck && npm run lint && npm run build` all pass in `web/`. Manual visual pass recommended before pushing — anchor colors are identical but scale neighbors shift subtly. If the palette ramp drift is noticeable, the OKLCH block in [web/tailwind.config.ts](web/tailwind.config.ts) is the only revert point; the other changes are independent.

## D-089 — Public signup form surfaces field-level validation errors
**Date:** 2026-05-14
**Why:** Logan reported a generic "Request failed validation." banner on `/apply/signup` with no indication of which field was wrong (his phone was `123456789` — no `+`/country code — and password was 4 chars). He read the banner as the page rejecting him outright ("it kicked me off"). The API was already returning the correct structured payload (`err.details.fieldErrors` from Zod's `flatten()`); only the frontend was throwing it away.

**Change:** Single-file edit to [web/src/pages/apply/Apply.tsx](web/src/pages/apply/Apply.tsx). The `ApplySignupPage` now keeps two error states — `formError` (banner) and `fieldErrors` (per-input) — and the catch block reads `(err as ApiHttpError).details.fieldErrors` into the latter. Each `<Input>` is wired with `error={fieldErrors[name]}`; the existing component already supported red border + `aria-invalid` + inline message ([Input.tsx:4–46](web/src/components/ui/Input.tsx)). Zod's "Invalid" message for the phone regex is replaced with `Include the + and country code, e.g. +919876543210.` so it mirrors the hint copy. The client-side password-mismatch check now flags the **confirm** input (where the inconsistent value was typed), not the password field. Backend untouched — `validatePolicy` and the Zod schema already enforce the right rules.

**Source:** Logan's screenshot + chat (2026-05-14); Explore findings on Apply.tsx, admissions.ts route schema, error.ts middleware, Input.tsx; CLAUDE.md §5 error envelope.
**How to apply:** Other public forms (login, password reset) have the same single-banner pattern and will need the same refactor in a follow-up PR — flagged as deferred, not blocking this fix. Verify via [docs/smoke/apply-signup-errors.md](docs/smoke/apply-signup-errors.md). `npm run typecheck -w web && npm run lint -w web` clean.

## D-090 — M10 scope decisions (additional features from May 2026 docs)
**Date:** 2026-05-20
**Why:** Two new requirements docs landed (`LMS_Requirements.docx`, `LMS_Faculty_Features_Requirements_.docx`) covering academic profile, internal chat, placement, payments, attendance, assignments, courseware, reports, faculty dashboard. Some asks contradict Phase-1 scope and need explicit go/no-go.

**Decisions (Vidit + Logan, AskUserQuestion 2026-05-20):**
1. **Timing:** ship all of it together — "Phase 1 + 2 both, commit by commit, then test on production."
2. **Online payment gateway — OUT.** Keep manual finance entry (cash / UPI / bank_transfer / cheque). BRD §6 ban stands.
3. **Internal chat — FULL** (1:1 + group + files + real-time + notifications). Architecturally large enough that this slice is deferred to a follow-up session — see [memory/milestones/M10-additional-features.md](memory/milestones/M10-additional-features.md) §"Deferred work".
4. **Placement / Jobs — FULL.** Job posts + applications + companies + analytics + per-student resume URL.

**Why this matters:** The BRD §6 ban on payment gateways is now explicitly confirmed under M10 (was previously a Phase-1 default). If a Phase-2 review later wants to add Razorpay, this entry is the rollback point.

**What landed across PRs #24–#28 + #29 (m10g memory):**
- New Indian-school doc types (SSLC / +2 / Degree / TC / Passport photo) + faculty quick-access tiles
- Student personal details — DOB, structured address, emergency contact, parent/guardian + Profile screen sections
- Reports module — Attendance / Batch summary / Assignment submissions, JSON + XLSX (exceljs new dep)
- Daily attendance auto-report cron (student + parent email at 18:30 IST)
- Placement / Jobs module — Company + JobPosting + JobApplication models, admin console, student feed, resume snapshot at apply time

**Source:** `LMS_Requirements.docx`, `LMS_Faculty_Features_Requirements_.docx` (both 2026-05-20).
**How to apply:** All M10 PRs share the `claude/m10*` branch prefix. Production at `india-learns-lms.onrender.com` deploys each merge automatically via `autoDeploy: true` in `render.yaml`. 501/501 tests passing across the merged set.

## D-091 — Doc-type single-source-of-truth in shared-types
**Date:** 2026-05-20
**Why:** Three different `documentType` enum definitions had drifted across `applicationDocument.ts` (the storage list, 7 items including `referee_letter`), `program.ts` (the admin-configurable list, 6 items), and `applicationDocumentService.ts` `TYPE_LABEL` map. Adding 5 new types meant touching 6+ files; future additions would risk drift.

**Change:** Consolidated into `packages/shared-types/src/enums.ts`:
- `PROGRAM_REQUIRED_DOC_TYPES` (11 items) — what admins can mark required + applicants upload in Step 6.
- `APPLICATION_DOCUMENT_TYPES` (12 items) — storage superset that also accepts `referee_letter`.
- `APPLICATION_DOCUMENT_TYPE_LABELS` — friendly labels reused by api + web.

`applicationDocument.ts` re-exports for backwards compat; `program.ts`, `admissions.ts` route, `programs.ts` route, `applicationDocumentService.ts`, `endpoints.ts`, `AdminProgramAdmissions.tsx`, and `Steps.tsx` all import from shared-types. `ApplicationDocumentDto.documentType` is now `ProgramRequiredDocType` (narrowed); the `referee_letter → other` mask in `toApplicationDocumentDto` is preserved.

**How to apply:** Add a new doc type by appending to `PROGRAM_REQUIRED_DOC_TYPES` + `APPLICATION_DOCUMENT_TYPE_LABELS` and rebuilding shared-types. No other file needs to change.

## D-092 — Resume URL on User (single canonical) + snapshot on JobApplication
**Date:** 2026-05-20
**Why:** Placement workflow needs (a) a resume the placement team can reach via the admin console, and (b) historical fidelity — past applications must not retroactively change if the student updates their resume later.

**Change:** `User.resumeUrl: string | null` — one canonical resume URL per student, paste-only for V1 (Drive / Dropbox / portfolio). `JobApplication.resumeUrl: string | null` — snapshot captured at `applyToJob()` time (preferring an explicit `resumeUrl` input override, else `User.resumeUrl`). Apply 422s `RESUME_REQUIRED` if neither is set.

**How to apply:** Direct file upload via Cloudinary is a follow-up; the contract here means `resumeUrl` can later point at a signed URL without an API change.

## D-093 — Internal chat deferred to follow-up session
**Date:** 2026-05-20
**Why:** Real-time chat (Socket.IO, sticky sessions on Render, possibly Redis pub/sub for multi-instance, JWT socket auth, file upload, in-app notifications) is a major architectural addition. Shipping it alongside 5 other PRs in one session would be reckless.

**Change:** Tracked as PR-E in M10 backlog. Planned as a 3-4 sub-PR sequence in a follow-up session:
1. Models + REST + polling (Conversation, Membership, ChatMessage, ChatAttachment)
2. Socket.IO server + JWT socket auth + real-time delivery
3. Web UI (chat list, thread view, composer, file upload)
4. Polish + notifications integration

**How to apply:** Next session: read `memory/milestones/M10-additional-features.md` §"Deferred work" for the design notes and entry point.

## D-094 — File uploads stored in MongoDB GridFS by default (no Cloudinary required)
**Date:** 2026-05-20
**Why:** Logan asked "can we upload directly on mongo db database which we have?" — she doesn't have Cloudinary credentials and wants production-ready file upload without depending on a paid third-party. LUC's V1 scale (~30 students/class × ~10 docs each × ~500 KB) is well under any Atlas tier's storage budget, so storing files in the same cluster as the rest of the app is fine.

**Change:**
- `STORAGE_PROVIDER` enum widened to `['cloudinary', 'mongo', 'stub']`; default flipped from `stub` to `mongo` so production "just works" the moment Atlas is connected.
- New `MongoStorageAdapter` (`api/src/integrations/mongoStorageAdapter.ts`) implements `StorageAdapter` against a `GridFSBucket` named `il_files` on the app's existing mongoose connection. Adapter `key` is the 24-char GridFS file `_id`; `url` is `${API_ORIGIN}/v1/files/<id>`.
- New `POST /v1/files/upload?folder=<folder>` (multer in-memory + 5 MB cap, auth-required) and `GET /v1/files/:id` (auth-required, streams from GridFS, sets `inline` content-disposition + 5-minute private cache).
- Three new `StorageFolder` values: `chat-attachments`, `student-documents`, `resumes`. `StorageUploadTicketResponse.provider` widened to include `'mongo'`.
- Frontend file pickers in `Chat.tsx` (attachments), `AdminUsers.tsx` (StudentDocumentsEditor + ResumeUrlEditor), `ProfilePage.tsx` (ResumeCard). URL paste fallback retained for everything except chat.
- `render.yaml`: `INTEGRATIONS_MODE=live`, `STORAGE_PROVIDER=mongo`. WhatsApp/Certifier still feature-flagged off and Email still `stub` so flipping `INTEGRATIONS_MODE` doesn't accidentally activate the unconfigured providers.

**Trade-off:** No CDN, files served straight from Mongo through the Node process. Atlas storage is ~10× more expensive per GB than Cloudinary, but at LUC scale that's irrelevant. To switch to Cloudinary later: set `STORAGE_PROVIDER=cloudinary` + provide credentials; the URL contract (`{ url, key }`) is identical so no consumers need changing.

**How to apply:** Use `getIntegrations().storage` (already abstracted via `StorageAdapter`). For UI uploads, call `filesApi.upload(file, folder)` from `web/src/lib/endpoints.ts`. For server-side uploads (e.g. PDF receipts), keep calling `storage.upload({ bytes, ... })` — the same code paths work across all three adapters.

## D-095 — `finance` role removed; admin absorbs everything; faculty content perms expanded
**Date:** 2026-05-20
**Why:** Logan: "remove finance fully, admin will handle every finance part also" + "syllabus admin and faculty can change, faculty can change course content, update video and pdf and modules also if they want". Two changes shipped together because they're both permission-system reshuffles touching the same role gates.

**Changes — Finance removal:**
- `ROLES` enum drops `'finance'` (shared-types + Mongoose User model + zod validators). Surviving non-role uses: `TICKET_CATEGORIES` keeps `'finance'` (subject-matter label for student fee questions); `DEPT_TAGS` keeps `'finance'` (admins who specialize).
- Every `requireRole(..., 'finance', ...)` swept: payments, receipts, fee structures, fee reminders, student fees, admissions/finance, tickets, staffTickets, placement analytics, reports. Each now resolves to `admin`+`superadmin`.
- `ticketRoutingService.routeTicket(category='finance')` now prefers `role='admin', deptTag='finance'` → falls back to any admin.
- `ticketService` STAFF_ROLES tightened to `admin | superadmin | faculty`; visibility/listing branches for finance dropped.
- Frontend: `/finance/*` route URLs kept (bookmark survival); role gate flipped to `['admin', 'superadmin']`; AppShell sidebar `finance:` branch removed and finance entries surfaced under admin. Mobile BottomTabs finance branch replaced with a "Record payment" admin tab. AdminUsers role dropdowns drop the Finance option. StudentFees suspension copy updated ("contact the office" not "contact finance").
- Seeds: `seedFinanceStaff()` deleted; admin user owns sample payment seeds. `seed-demo.ensureFinance()` returns the first admin (defensive fallback creates one).
- Tests: every `makeUser({ role: 'finance' })` migrated to either `makeUser({ role: 'admin', deptTag: 'finance' })` (where the test asserted ticket routing) or `makeAdmin()` (where the test exercised finance permissions). Tests that asserted "finance 403 on X" either deleted (premise gone) or repurposed (e.g. feedback non-academic-staff guard → admissions_officer).

**Changes — Faculty content perms:**
- `moduleService.FACULTY_PATCH_FIELDS` extended to include `title` and `order` (was: content / aim / prerequisites / facultyNotes / syllabus only). Faculty assigned to the course can now rename + reorder modules.
- `moduleService.deleteModule()` opened to faculty when `facultyAssignedToCourse(course, userId)`; non-staff still 403.
- `courseService.updateCourse()` opened to faculty for content fields: introduced `FACULTY_COURSE_PATCH_FIELDS = new Set(['summary'])`. Faculty on the course can PATCH `summary` only; any structural field (`name`, `slug`, `sequential`, `facultyIds`, `certificateTemplateId`) returns 403. The PATCH route gate widened from `requireRole('admin', 'superadmin')` to `requireRole('admin', 'superadmin', 'faculty')`; the field allowlist is enforced in the service.
- UI surface: existing ContentTab already lets faculty edit `aim` / `facultyNotes` / `syllabus`; module title + order edit and module delete are now backend-allowed but not yet wired in UI — operator can drive via API today and we'll surface in a follow-up PR if Logan asks.
- Tests in `modules.crud.test.ts` flipped: "faculty 403 on title/order" → "faculty 200" (with assertions on the returned doc); "faculty 403 on DELETE" split into "faculty assigned CAN delete" + "faculty NOT assigned 403 on delete".

**What stays the same:**
- Course CREATE + DELETE remain admin-only (structural decision, not content).
- Course publish / unpublish remain admin-only (lifecycle, not content).
- Storage upload ticket for `course-pdfs` + `course-videos` was already faculty-accessible on assigned courses (D-027); no change needed for video/PDF replacement.
- 'finance' as a TICKET_CATEGORY survives — students still raise fee questions under that label; tickets just route to admin instead of a dedicated finance role.

**How to apply:** Faculty editing capability is enforced server-side (field allowlist + facultyAssignedToCourse check). Frontend can call existing endpoints (modulesApi.update, coursesApi.update) with content fields; admin retains full access. Migration note for any DB rows that still have `role: 'finance'`: those users will fail `User.role` enum validation on save. Pre-launch this isn't a real concern (no production finance users); if any creep in, run a one-time `db.users.updateMany({ role: 'finance' }, { $set: { role: 'admin', deptTag: 'finance' } })` migration.

## D-096 — Visitor Leads + manual installments + faculty publish + completion notifications
**Date:** 2026-05-20 (M10s)
**Why:** Logan's "LMS Visitor List Template" telegram message + the attached Student_Fee_Structure_and_Schedule.xlsx + the explicit role split ("Admin (IT/System Contact): records payments, generates receipts, receives course-completion notifications" + "Faculty: adds and edits content, publishes courses to students"). User explicitly excluded: online payments (D-090 still stands) and OTP-send for visitor leads.

**Changes — Visitor Leads (admin-captured prospect funnel):**
- New `VisitorLead` Mongoose model + DTO + service + admin CRUD routes (`/v1/visitor-leads`).
- Schema fields: firstName / lastName / highestQualification / dateOfBirth / currentAddress / phoneE164 / email / parentGuardianContact / leadSource / socialMediaId / otpVerificationStatus / status / notes / assignedToUserId / convertedApplicationId / createdByUserId.
- Lead source enum: `reference | google | social_media | walk_in | meta | agent | other` (mirrors the Excel "Source" column + the screenshot dropdown).
- Status enum: `new | contacted | qualified | converted | dropped`.
- Partial unique index on `phoneE164` (active rows only) so soft-deleted leads free the phone for re-capture.
- `otpVerificationStatus` is a manual flag — no OTP send in V1; admin toggles Pending → Verified after a phone call.
- AdminVisitorLeadsPage (web) — list + filters (q / status / source) + create/edit modal + soft-delete.
- Sidebar entry under admin section.

**Changes — Manual installment management:**
- New `installmentService.ts` + `/v1/installments` routes (admin-only): `POST` add custom row, `PATCH /:id` edit label/amount/dueDate/status, `POST /:id/waive` shorthand.
- Every mutation recomputes the parent invoice's `totalPaise` / `paidPaise` / `balancePaise` + flips `status` to `'settled'` when fully paid. Waived rows excluded from totals.
- Audit log entries (`fees.installment.created`, `fees.installment.updated`) added to AUDIT_ACTIONS.
- FinanceStudentDetailPage rebuilt with an Installments card that surfaces Edit / Waive on every row + an "Add installment to an invoice" button per existing invoice.
- Use case (from Logan's Excel): admin auto-generates installments from FeeStructure templates, then adds custom rows like "Registration Fee — Seat Reservation" and "Admission Fee — Upon Admission" with their own amounts + due dates.

**Changes — Faculty publishes courses:**
- `publishCourse` + `unpublishCourse` opened to faculty assigned to the course (via `facultyAssignedToCourse`). Admin / superadmin still unrestricted.
- New `assertCanPublishCourse(course, actor)` guard in courseService.
- PATCH route gate widened from `requireRole('admin', 'superadmin')` to include `'faculty'`; service layer enforces the assignment.
- CourseShell header now shows "Publish course" / "Unpublish" buttons to anyone with `canWrite=true` (faculty on roster OR admin/superadmin).

**Changes — Course completion notification to admin:**
- Sibling listener on `course.completed` domain event in `certificateService.ts`. Pings every active admin + superadmin via `enqueueNotification` with type `'student.course_completed'`. Failure is isolated from certificate issuance — admin notif failure doesn't block the cert.
- New NotificationType added to enum + CHANNELS_BY_TYPE map (inapp + email, no WhatsApp since no template approved).

**What stays the same:**
- Online payments — still declined (D-090).
- OTP send for visitor leads — explicitly excluded by Logan ("except sending otp build everything").
- Course creation / deletion / faculty roster assignment — still admin-only (structural).

**Deliverable:** `docs/guides/India_Learns_Admin_Faculty_Guide.docx` — step-by-step user guide for admin + faculty covering every feature shipped in PRs A–S. Generated at the end of the session and saved to the repo + the operator's Downloads.

## D-097 — Staff attendance + apply parent UI + auth field errors + sessions filter + public visitor form
**Date:** 2026-05-20 (M10u)
**Why:** User: "finish all the tasks except cloudinary and otp, rest build each and everything end to end". One bundle that closes the last functional gap from the requirements docs (staff attendance per LMS_Requirements §4 "for students and staff") and ships every code-only polish item that was still open.

**Changes:**
1. **Staff attendance module.** New `StaffAttendance` model + service + routes (`/v1/staff-attendance`). Faculty self-marks; admin can mark on behalf or override. Upsert per (userId, date) — re-marking same day overwrites the existing row. New status enum: `present | absent | late | leave | half_day`. Audit log entries `staff_attendance.marked` / `staff_attendance.updated`. Admin UI at `/admin/staff-attendance` with list + filter + on-behalf-of mark form. Faculty self-mark widget on `/faculty/dashboard`.
2. **Apply Form step 3 `parentGuardian` UI.** DTO already accepted the field (D-091); now there's a fieldset on the apply form so applicants can fill it during sign-up instead of waiting for the Profile screen. Empty objects are stripped to null before save so we don't pollute drafts.
3. **Field-level errors on Login / Reset / Accept-invite.** Same pattern as the signup fix — split `formError` (banner) from `fieldErrors` (inline `<Input error={…}>`). Zod failures now show on the specific Email / Password field instead of a single opaque "Request failed validation." banner.
4. **`sessionsHeldFrom` / `sessionsHeldTo` filter on attendance report.** New optional query params on `GET /v1/reports/attendance`. The report counts only sessions whose actual held-date (completedAt fallback to scheduledStart) falls in the window. Filter is post-applied in JS so it composes with the existing batch + date-range + course filters.
5. **Public visitor self-registration.** New `/v1/public/visitor/register` route (no auth, IP rate-limited 5/hr) + `/visitor-register` page (no AppShell, plain landing-style form). Server forces `otpVerificationStatus=pending` and `status=new` regardless of client input. Lead appears in `/admin/visitor-leads` immediately. Audit log actor is the first active superadmin (no anonymous writes).
6. **TASKS.md cleanup.** Marked stale entries that shipped under M8 / M10 as complete (M3 / M4 / M5 web clients, Admin ticket dashboard, Quiz/exam attempt screens, Deep admin CRUD, Finance payments list, Faculty grading + feedback editor, PR-E internal chat). The file now accurately reflects what's open.

**What we deliberately skipped:**
- Cloudinary CDN swap (env flip only; not needed today).
- OTP send for visitor leads (user excluded explicitly).
- Course-scoped report variants for faculty (admin reports already support batchId filter; faculty's batches are the only ones shown).
- PWA raster icons + bundle split (v1.1 polish; not blocking launch).
- Backfill ApplicationDraft → User personal details (defensive only; admin can manually edit via AdminUserDetail).

**How to apply:**
- Staff attendance is enforced server-side (role gate + facultyCanMarkFor check). Faculty UI button auto-handles the upsert.
- Faculty publishes courses (D-096) is unchanged; staff attendance is the new addition this PR.
- Public form is rate-limited but otherwise open — if abuse becomes a problem later we can add CAPTCHA. The system actor pattern (first active superadmin) keeps the audit trail intact.

## D-098 — File storage migrated from MongoDB GridFS to AWS S3
**Date:** 2026-05-26
**Why:** User asked to move uploads off MongoDB entirely and onto S3. GridFS had been the default since D-094 (M10q). S3 gives us standard object storage (versioning, lifecycle rules, cross-account replication, CDN-readiness via CloudFront later) and stops bloating the Atlas cluster with file bytes.

**Setup:**
- Bucket: `india-learns-lms-prod` in `ap-south-1` (Mumbai) for DPDP Act 2023 data-residency alignment (matches Atlas region).
- Hardening: BucketOwnerEnforced (ACLs disabled), full block-public-access, default AES256 + bucket-key encryption, versioning ENABLED.
- IAM user `vidit` (account 635394566074) owns the keys used in dev; production should issue a least-privilege IAM user scoped to s3:PutObject/GetObject/DeleteObject/ListBucket on this bucket.

**Architecture:**
- `S3StorageAdapter` (api/src/integrations/s3StorageAdapter.ts) implements the same `StorageAdapter` interface as the GridFS, Cloudinary, and Stub adapters. Bytes go to S3; per-file metadata (filename, contentType, size, folder, uploader) lives in the new `FileMeta` Mongo collection (api/src/models/fileMeta.ts) keyed by ObjectId.
- S3 object key layout: `<folder>/<file-objectid-hex>` so the bucket browses cleanly in the console.
- `url` returned by upload() is still `${API_ORIGIN}/v1/files/<id>` — same contract as GridFS, so URL fields stored anywhere in Mongo (course materials, ticket attachments, avatars) keep resolving after the cutover.
- `/v1/files/:id` route tries S3 first (FileMeta lookup → S3 GetObject stream), falls back to GridFS for any not-yet-migrated file. Once the migration completes the GridFS path is effectively dead but kept as a safety net.

**Provider switching:** `STORAGE_PROVIDER=s3|mongo|cloudinary|stub`. Default flipped to `s3`. Required env vars when `s3`: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Optional: `AWS_S3_ENDPOINT` (LocalStack/MinIO), `AWS_S3_SIGNED_URL_TTL_SEC` (default 300).

**Migration script:** `npm run migrate:gridfs-to-s3 -w api -- [--dry-run] [--keep]`. Each GridFS file becomes an S3 object at `<folder>/<original-gridfs-objectid>` plus a FileMeta row with the same ObjectId — every existing `/v1/files/<id>` URL keeps resolving without any DB rewrites. Idempotent: re-runs skip files that already have a FileMeta record. Migration logic is extracted into `runGridfsToS3Migration()` in api/src/services/migrateGridfsToS3.ts so tests can call it directly.

**End-to-end tests:** Two live S3 round-trip tests gated by `AWS_S3_INTEGRATION=1` so CI is unaffected:
- `tests/integration/s3RoundTrip.test.ts` — upload → FileMeta written → signedUrl returns a real presigned URL → GetObject streams the bytes back → delete removes both.
- `tests/integration/migrateGridfsToS3.test.ts` — seeds `il_files.files` + `il_files.chunks` directly (the GridFSBucket write stream hangs under mongodb-memory-server on Node 24), runs the migration against real S3, asserts S3 has the object + FileMeta row + GridFS is empty.

**How to apply:**
- Local dev: leave `STORAGE_PROVIDER=stub` in `.env`, no AWS keys needed.
- Render staging/prod: set `STORAGE_PROVIDER=s3` + the four AWS env vars. Run the migration script once during cutover.
- Cloudinary keys are still accepted (`STORAGE_PROVIDER=cloudinary`) but are no longer the recommended path.
- The IAM keys pasted in chat on 2026-05-26 should be rotated after the migration completes; they were used to create the bucket and seed/test it.

## D-107 — Slide-deck "Replace deck (JSON)" hardened: per-slide validation + viewer crash guard
**Date:** 2026-05-31
**Why:** Faculty (Logan) hit two production bugs on the slides viewer. (1) **Corruption** — uploading a wrong-shaped JSON deck (e.g. a PowerPoint converted to JSON) via "Replace deck (JSON)" was persisted verbatim: `replaceSlideBody` only checked the payload was a non-empty array, never the per-slide shape, and `Material.body` is a `Mixed` field with no schema. The slide count jumped (3 → 13) and the deck was corrupted. (2) **Crash** — the viewer then died with "Cannot read properties of undefined (reading 'title')" because `SlideRender` read `slide.content.title` when `content` was undefined, so the deck could no longer be opened at all.

**Fix:**
- Backend (`api/src/services/materialService.ts`): new `assertRenderableSlides()` rejects (422) any deck where a slide isn't a plain object carrying a `content` object — names the offending slide and points faculty at "Download deck" / "Upload PowerPoint / PDF". Runs **before** `material.save()`, so a bad payload never mutates the stored deck. Added `markModified('body')` so a valid replacement always persists on the Mixed field.
- Frontend (`web/src/lib/slideShape.ts`): extracted two pure, tested helpers — `normalizeSlides()` (drops null/non-object holes, unwraps `{ slides: [] }`) and `slideContent()` (returns `{}` for missing/array/null content, never throws). `MaterialViewer` uses both, guards `slide?.title`, resets the slide index on `material.updatedAt`, dumps the raw slide for unknown shapes (corrupt deck is openable, not a white screen), and DRYs the download path.
- Client `MAX_JSON_BYTES` aligned to the server's 1 MB `express.json` limit (was 5 MB — a 1–5 MB file would 413 with a generic error).

**Recovery:** Logan's already-corrupted "Who Works at the Airport?" deck now opens via the JSON-dump fallback (no crash) and can be re-imported from the generator or re-uploaded as valid JSON.

**Tests:** `api/tests/integration/materials.slides.test.ts` — 8 cases incl. the corruption regression (proves a rejected payload leaves the stored deck intact). Pure-function cases added to `web/e2e/slideviewer-fixtures.spec.ts`.

**Note:** Validation requires each slide's `content` to be an object — the only shape the renderer + generator use. A legacy bare-array `content`, if any exists, would be rejected on re-upload (acceptable tightening, scoped to the replace path).
