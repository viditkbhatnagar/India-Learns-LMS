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
