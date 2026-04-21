# M2 — Auth + user management

**Date completed:** 2026-04-21
**Supersedes:** — (extends M1 foundations)
**Test result:** 13 files / 56 tests green · services coverage 89% lines / 95.7% functions / 70.1% branches.

**Post-implementation review corrections** (2026-04-21):
- **D-020** — `loadEnv()` refuses dev-default/weak secrets in production (security-review).
- **D-021** — Fees-suspended students retain login access per PRD §3.2 (M2-review).
- **D-022** — `POST /v1/users` tightened to admin-only per TRD §5.2 (M2-review).
- **D-023** — Refresh-token rotation + login-fail counter made atomic (M2-review).
- Cookie `Path=/` (Q-M2-04 opened) so `__Host-` prefix remains valid in real browsers.
- `recordAudit` wrapped in try/catch — audit failures no longer cascade into request path.
- Soft-delete now also revokes all refresh tokens.

## What was built

Server-only auth + user-admin surface. No UI (M3 consumes it).

- **Models** (all idempotent via `mongoose.models.X ?? model(...)` per D-018):
  - `User` — verbatim TRD §4.1 (role, code, email unique, passwordHash, status/suspensionKind, programId/batchId, deptTag, isCourseCoordinator, sessionCap, deletedAt). `toJSON` strips `passwordHash`, `passwordHistoryHashes`, `loginFailCount`, `lockedUntil`; maps `_id → id`.
  - `InviteToken` — `{userId, tokenHash (unique), kind: 'invite'|'reset', expiresAt, usedAt}` + Mongo TTL on `expiresAt`.
  - `RefreshToken` — TRD §4.11 fields **plus `familyId: ObjectId`** (D-013) for reuse-detection blast radius.
  - `AuditLog` — TRD §4.12 (+ `details` mixed for failure-reason metadata).
  - `Counter` — `{key, seq}` for `IL-<YYYY>-<NNNN>` user codes (D-014), reusable in M5/M6.
- **Services** (all under `/api/src/services/`):
  - `passwordService` — Argon2id `timeCost=3, memoryCost=65536, parallelism=1` (TRD §7), `validatePolicy` (≥10 chars + letter + digit per PRD §5.2), `assertNotReused` against last 3.
  - `tokenService` — `jose` HS256 access token (15 min), `sub/role/status/batchId/iss='il'/aud='web'/jti` claims; `generateOpaqueToken()` (32-byte base64url + sha256 hash); `sha256(plain)`.
  - `refreshTokenService` — `issue`, `rotate` (reuse → `updateMany({familyId, revokedAt: null}, revokedAt=now)` + throw 401), `revoke`, session-cap LRU eviction via `sort({createdAt: -1}).slice(cap)`.
  - `inviteService` — `createInviteToken` marks prior un-used tokens used before issuing a new one; `consumeInviteToken` atomic via `findOneAndUpdate({_id, usedAt:null})`.
  - `authService` — orchestrates login (locks after `LOGIN_LOCK_AFTER=10` failures for `LOGIN_LOCK_DURATION_MIN=30m`), invite accept, refresh, logout, password reset request/confirm, password change. Writes D-015 audit entries.
  - `userService` — create/list/get/update/suspend/unsuspend/resend-invite/soft-delete. Soft-delete scrubs email to `deleted+<id>@removed.invalid` per BR-11. Self-patch restricted to `{name, phoneE164}`.
  - `auditService` — `recordAudit`, `scrubUser` (D-017).
  - `counterService` — `nextUserCode(year)` via upsert-`$inc` (D-014).
- **Integrations** (under `/api/src/integrations/`):
  - `ConsoleEmailAdapter` + `ConsoleWhatsAppAdapter` (dev/test default, log via pino).
  - `ResendEmailAdapter`, `SendGridEmailAdapter`, `MetaWabaAdapter` — class stubs that throw "not wired" (wired in M4/M5/M8).
  - Factory in `integrations/index.ts` honours `INTEGRATIONS_MODE=stub|live` + `EMAIL_PROVIDER` + `WHATSAPP_ENABLED`. Tests inject spies via `setIntegrations(...)`.
- **Middleware**:
  - `requireAuth` — Bearer token → jose verify → rejects `status ∈ {pending, suspended, revoked}` with canonical codes.
  - `requireRole(...roles)` — 403 `FORBIDDEN`.
  - `buildLoginLimiter` (5 / 15 min / ip+email) + `buildPasswordResetLimiter` (3 / hour / ip). Both pass-through when `RATE_LIMITS_DISABLED=true` (D-019).
  - `errorHandler` extended to map Zod + Mongo 11000 (email dup → 409 `USER_EXISTS`).
- **Routes** under `/v1/*` mounted in [api/src/app.ts](../../api/src/app.ts) after `cookieParser()`.

## API surface mounted

**`/v1/auth`** (public unless marked):

| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/login` | `{email, password, deviceId}` | — (rate-limited) |
| POST | `/invite/accept` | `{token, password, deviceId}` | — |
| POST | `/refresh` | `{deviceId?}` + `__Host-il_rt` cookie | — |
| POST | `/logout` | — | Bearer |
| POST | `/password/reset/request` | `{email}` | — (rate-limited, always 202) |
| POST | `/password/reset/confirm` | `{token, password}` | — |
| POST | `/password/change` | `{current, next}` | Bearer |

**`/v1/users`** (all `requireAuth`):

| Method | Path | Role gate |
|---|---|---|
| GET | `/me` | any |
| GET | `/` `?role=&status=&q=&page=&limit=` | admin, superadmin |
| POST | `/` | admin, superadmin |
| GET | `/:id` | admin, superadmin, or self |
| PATCH | `/:id` | admin, or self (subset) |
| POST | `/:id/suspend` `{reason}` | admin |
| POST | `/:id/unsuspend` | admin |
| POST | `/:id/resend-invite` | admin |
| DELETE | `/:id` — soft delete | admin |

All success responses wrapped as `{data: ...}` per TRD §5; errors as `{error: {code, message, details?}}` per TRD §8.

## Tests (48 / 48 green)

- **Unit** (`/api/tests/unit/`):
  - `passwordService.test.ts` — 11 cases: hash/verify round-trip, policy rejections (too short / no digit / no letter), reuse detection against current + history, `rotateHistory` keeps 3.
  - `tokenService.test.ts` — 4 cases: JWT round-trip, tampered reject, opaque token shape/hash, uniqueness over 50 samples.
  - `refreshTokenService.test.ts` — 5 cases: issue, rotate + mark prior, reuse → family revoked, session-cap evicts oldest, logout revokes.
  - `counterService.test.ts` — 2 cases: monotonic per year, 20-parallel distinct.
- **Integration** (`/api/tests/integration/`):
  - `auth.invite.test.ts` — admin creates student → email logged → accept → tokens + cookie; duplicate email → 409 `USER_EXISTS`; token reuse → 410 `TOKEN_USED`.
  - `auth.login.test.ts` — 200 + cookie on correct creds; 401 on bad password increments `loginFailCount`; 10 failures → `lockedUntil` set; `SUSPENDED_ACCESS` 403 when suspended; soft-deleted cannot log in.
  - `auth.refresh.test.ts` — rotation produces new cookie; old cookie → 401 + family revoked; logout revokes.
  - `auth.passwordReset.test.ts` — request returns 202 always; confirm rejects reuse; password change requires current; reuse of prior password rejected.
  - `users.crud.test.ts` — list filters, PATCH + soft-delete, suspend/unsuspend, `/me`, non-admin 403 on admin routes, student self-patches name but not batchId.
  - `audit.test.ts` — `auth.login.success`, `user.created`, `user.suspended` written with scrubbed before/after (no `passwordHash`); `auth.login.failure` carries `details.reason: 'bad_password'`.
  - `rateLimit.test.ts` — dedicated file that re-enables limits + creates fresh app; 4th login returns 429; 3rd password-reset returns 429.

**Coverage on `/api/src/services/**`:** 89% statements · 95.8% functions · 69.6% branches. Exceeds the 70% gate.

## Files changed / added

**Added:**
- `api/src/models/{user,inviteToken,refreshToken,auditLog,counter,index}.ts`
- `api/src/services/{passwordService,tokenService,refreshTokenService,inviteService,authService,userService,auditService,counterService}.ts`
- `api/src/middleware/{auth,requireRole,rateLimit}.ts`
- `api/src/routes/{auth,users,index}.ts`
- `api/src/integrations/{emailAdapter,whatsappAdapter,index}.ts`
- `api/src/utils/{cookies,time}.ts`
- `api/scripts/seed-superadmin.ts`
- `api/tests/helpers/{db,env,factories,http,integrations}.ts`
- `api/tests/unit/{passwordService,tokenService,refreshTokenService,counterService}.test.ts`
- `api/tests/integration/{auth.invite,auth.login,auth.refresh,auth.passwordReset,users.crud,audit,rateLimit}.test.ts`
- `packages/shared-types/src/{enums,integrations}.ts` + `dto/{auth,user}.ts`

**Modified:**
- `api/src/app.ts` — added `cookieParser()`, `trust proxy 1`, mounted `v1Router()`.
- `api/src/config/env.ts` — added `ARGON2_*`, `INVITE_TOKEN_TTL_DAYS`, `RESET_TOKEN_TTL_MIN`, `SESSION_CAP`, `INTEGRATIONS_MODE`, `COOKIE_SECURE`, `PASSWORD_RESET_RATE_MAX`, `PASSWORD_RESET_RATE_WINDOW_MIN`, `RATE_LIMITS_DISABLED`. Added `resetEnvCache()` for tests. Added `silent` to LOG_LEVEL enum.
- `api/src/middleware/error.ts` — maps Zod → 422 `VALIDATION_FAILED` and Mongo 11000 → 409 `USER_EXISTS`.
- `api/.env.example` — new vars + `SUPERADMIN_*` seed inputs.
- `api/package.json` — deps (`argon2`, `jose`, `express-rate-limit`, `cookie-parser`, `@types/cookie-parser`, `@vitest/coverage-v8`); scripts (`test:coverage`, `seed:superadmin`).
- `api/vitest.config.ts` — coverage gate (70% lines/functions/statements, 55% branches) on `src/services/**`; `singleFork: true` for mongodb-memory-server stability.
- `packages/shared-types/src/index.ts` — re-exports.
- `eslint.config.js` — allow `_id/__v` (`no-underscore-dangle`); loosen `no-restricted-syntax` to keep `for..of` but still ban `for..in`; allow `no-param-reassign` in `models/` + `services/` for Mongoose idioms; `no-console` + destructuring relaxed in `tests/` + `scripts/`; disabled `class-methods-use-this` for integration adapters.

## Example curl flow (DoD smoke)

Assuming `MONGODB_URI` points at a live Mongo + the API is up on `:4000` with `INTEGRATIONS_MODE=stub`:

```bash
# 0. Seed the super-admin
SUPERADMIN_EMAIL=admin@luc.local SUPERADMIN_PASSWORD='Admin#12345' \
  SUPERADMIN_NAME='Logan' SUPERADMIN_PHONE='+971500000000' \
  MONGODB_URI='mongodb://localhost:27017/il-dev' npm run seed:superadmin -w api

# 1. Admin login
curl -sS -c cookies.txt -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@luc.local","password":"Admin#12345","deviceId":"dev-1"}'
# → 200 { data: { user, accessToken, accessTokenExpiresIn } } + Set-Cookie __Host-il_rt

export AT=<paste accessToken>

# 2. Create a student — invite email logged in server stdout as 'email.send'
curl -sS -X POST http://localhost:4000/v1/users \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"role":"student","name":"Asha R","email":"asha@example.com","phoneE164":"+919999000001"}'
# → 201 { data: { user: { id, code: "IL-2026-0001", status: "pending", ... } } }

# 3. Student accepts invite (extract token from server log's email.send payload)
curl -sS -c stu.txt -X POST http://localhost:4000/v1/auth/invite/accept \
  -H 'content-type: application/json' \
  -d '{"token":"<plain>","password":"Str0ngPass1!","deviceId":"dev-stu"}'
# → 200 + refresh cookie

# 4. Refresh
curl -sS -b stu.txt -c stu.txt -X POST http://localhost:4000/v1/auth/refresh \
  -H 'content-type: application/json' -d '{"deviceId":"dev-stu"}'
# → new accessToken + rotated cookie

# 5. Logout
curl -sS -b stu.txt -X POST http://localhost:4000/v1/auth/logout \
  -H "authorization: Bearer <student accessToken>"
# → 204 + cleared cookie

# 6. Non-admin hits admin route → 403
curl -sS -o /dev/null -w "%{http_code}\n" -X GET http://localhost:4000/v1/users \
  -H "authorization: Bearer <student accessToken>"
# → 403
```

## Open items / known gaps for later milestones

- **Q-M2-01 (open):** `deviceId` is currently accepted as a free-form string from the client. When M3 lands the web client, confirm the UUIDv4-in-localStorage convention and enforce server-side format if desired.
- **Q-M2-02 (open):** password-reset audit records the submitted email plainly in `details`. Acceptable per BR-11 since audit log access is admin-gated (M6 ships the audit UI); revisit if Logan flags it.
- **Risk:** in-memory rate-limit store resets on process restart and doesn't share across Render replicas. Swap to Redis-backed `rate-limit-redis` at M9 before multi-instance deploy (runbook note added below).
- **Risk:** DPDP export/delete endpoints (TRD §11 `POST /v1/me/export-data`, `/me/delete`) are deliberately deferred — captured as Q-PENDING in open-questions.

## For the next session (M3 — Course + enrollment)

- **Extend shared-types/src/enums.ts** with course/module/batch/program enums as you model them. The re-export from `index.ts` is already wired.
- **Reuse `Counter`** for program/batch codes if needed (`counterService` is generic — just add a new `nextXCode` helper).
- **Reuse `requireRole()` + `requireAuth`** for every protected route; the auth context is `req.auth = { userId, role, status, user }` where `user` is the full `HydratedUser` (already fetched).
- **Audit logging is a service-level concern** — pull `recordAudit` + `scrubUser` into any write path. Add new verbs to `AUDIT_ACTIONS` in `shared-types/src/enums.ts`.
- **Integration spies** — any new adapter should export an interface from `shared-types/src/integrations.ts` and a `Console*Adapter` + live-adapter-stub pair. The factory in `api/src/integrations/index.ts` is the single wiring point.
- **Tests**: the `useMongo() + useIntegrationSpies() + http()` harness is the baseline. Add a factory helper per model to `tests/helpers/factories.ts`.

## Surprises during M2

1. **Mongoose's `model()` is process-scoped, vitest isolates per file** — naive re-registration throws `OverwriteModelError`. Fixed by idempotent `mongoose.models.X ?? model(...)` in every model file (D-018).
2. **`express-rate-limit` in-memory store is shared across createApp() calls within a process** — tests for one limiter polluted others. Fixed with a `RATE_LIMITS_DISABLED` flag (D-019) + a dedicated focused test file that builds a fresh app.
3. **`jose` payload types are strict** — couldn't spread a partial JWT claim set; had to assemble the payload explicitly and let type narrowing from `SignJWT.setSubject`/`setIssuer` handle the rest.
4. **Argon2 dev cost is high** — with production params (timeCost=3, memoryCost=65536) hashing takes ~300ms. Dropped to `timeCost=2, memoryCost=4096` in test env for suite speed; prod defaults unchanged.
5. **TRD §5 says `{data}` success envelope**, which M1's `/health` doesn't use — kept `/health` unchanged since it's a liveness probe, not a data endpoint. All `/v1/*` routes wrap in `{data}`.
