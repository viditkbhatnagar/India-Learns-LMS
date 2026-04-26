# Cryptography

This document describes every place India Learns relies on cryptography, the algorithms and parameters in use, and the rationale. All claims are backed by source citations so a reviewer can verify in minutes.

## 1. Transport — TLS

- **Where:** Render terminates TLS at the edge for `{{WEBSITE_URL}}` (production) and `il-app.onrender.com` (staging). The Node service behind the edge listens on plain HTTP because Render's internal traffic is private.
- **HSTS and security headers:** [`api/src/app.ts`](../../api/src/app.ts) calls `helmet()` with defaults. This sets HSTS (`max-age=15552000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control: off`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, and a default `Content-Security-Policy` that disallows inline scripts.
- **CORS:** `cors({ origin: env.WEB_ORIGIN, credentials: true })` — strict origin allowlist. In single-service deploys (production) the API and SPA share the Render origin, so CORS preflights never fire.
- **Cipher suites:** managed by Render. We do not pin cipher lists; Render maintains current TLS configurations.

## 2. Password hashing — Argon2id

[`api/src/services/passwordService.ts`](../../api/src/services/passwordService.ts) uses the `argon2` Node binding (`argon2id` variant). Defaults from [`api/.env.example`](../../api/.env.example):

| Parameter | Value | Why |
|---|---|---|
| `ARGON2_TIME_COST` | `3` | Three iterations balances response time and brute-force cost on Render's standard CPU. |
| `ARGON2_MEMORY_COST` | `65536` (64 MiB) | OWASP-recommended floor for 2024+. |
| `ARGON2_PARALLELISM` | `1` | Single-threaded; matches Render Standard plan headroom. |

Policy ([`passwordService.ts:validatePolicy`](../../api/src/services/passwordService.ts)):

- Minimum length **10**.
- Must contain at least one letter and one digit.
- Cannot match the user's last three passwords (`assertNotReused` checks the current `passwordHash` plus the rolling `passwordHistoryHashes` list, capped at 3).

Verifying a password is constant-time inside `argon2.verify`. We never compare hashes manually.

## 3. JWT — access tokens

[`api/src/services/tokenService.ts`](../../api/src/services/tokenService.ts) signs access tokens with the `jose` library:

| Property | Value |
|---|---|
| Algorithm | `HS256` (HMAC-SHA-256) |
| Issuer (`iss`) | `il` |
| Audience (`aud`) | `web` |
| Subject (`sub`) | `User._id.toString()` |
| Custom claims | `role`, `status`, `batchId` |
| TTL | `JWT_ACCESS_TTL=15m` (default) |
| `jti` | 12-byte URL-safe base64 (random) — supports future revocation if needed |

The secret is `JWT_SECRET`. Production refuses to start unless the secret is at least 32 characters and not the dev default — see [`api/src/config/env.ts:assertProdSecrets`](../../api/src/config/env.ts).

Verification (`verifyAccessToken`) requires matching `iss` and `aud`, a non-expired `exp`, and a string `sub`. Any failure surfaces as `HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired token.')`.

We picked HS256 over RS256 because Phase 1 has a single trust domain (one API, one SPA). When we add an external relying party we will revisit and migrate to asymmetric keys.

## 4. Refresh tokens — opaque + SHA-256

[`api/src/services/refreshTokenService.ts`](../../api/src/services/refreshTokenService.ts) and [`tokenService.ts:generateOpaqueToken`](../../api/src/services/tokenService.ts):

- Plaintext refresh token: 32 random bytes encoded as URL-safe base64.
- Stored in DB as a SHA-256 hex digest only — recovering the plaintext from the database requires breaking SHA-256.
- Family rotation: each refresh token has a `familyId`. Rotation creates a fresh token and links `rotatedFromId`/`rotatedToId`. **Reuse of an already-revoked token revokes the entire family**, on the assumption the token was stolen.
- Concurrency: rotation uses `findOneAndUpdate({ revokedAt: null }, { revokedAt: now })` so only one refresh wins; losers see the row already-revoked and trigger family revocation.

The plaintext lives only in the `__Host-il_rt` cookie:

| Cookie attribute | Value | Why |
|---|---|---|
| Name | `__Host-il_rt` | The `__Host-` prefix forces `Secure`, `Path=/`, and forbids `Domain` — browsers reject any modification. |
| `httpOnly` | `true` | JS cannot read the cookie. |
| `secure` | `true` in production (controlled by `COOKIE_SECURE` env) | Never sent over HTTP. |
| `sameSite` | `strict` | No cross-site request includes the cookie — kills CSRF for refresh/logout. |
| `path` | `/` | Required for the `__Host-` prefix. Route-level middleware gates *where* the cookie is read (only `/v1/auth/refresh` and `/v1/auth/logout`). |
| `maxAge` | parsed from `JWT_REFRESH_TTL` (default 14 days) | Same as DB row expiry. |

There is a deliberate trade-off in [`api/src/utils/cookies.ts`](../../api/src/utils/cookies.ts): the TRD originally specified `Path=/v1/auth/refresh`, but the `__Host-` prefix mandates `Path=/`. We chose the stronger guarantee (browser-enforced no-domain, no-overwrite) and gate where the cookie is *read* server-side instead.

## 5. HMAC — cron job auth

Render cron jobs hit `/v1/jobs/*` with two custom headers, verified by [`api/src/middleware/requireJobAuth.ts`](../../api/src/middleware/requireJobAuth.ts):

- `x-job-timestamp` — Unix seconds.
- `x-job-signature` — `HMAC-SHA256(JOB_SECRET, rawBody + timestamp)`, hex.

Properties:

- **Replay window:** 5 minutes (`REPLAY_WINDOW_SEC = 300`). Outside that window, requests are rejected.
- **Timing-safe comparison:** `crypto.timingSafeEqual` over hex buffers; size mismatch returns false instantly.
- **Raw body capture:** [`app.ts`](../../api/src/app.ts) sets `express.json({ verify: (req, _, buf) => req.rawBody = Buffer.from(buf) })` so the HMAC is computed over the exact bytes the client signed (not the post-parse re-serialised form).

Rotation: `JOB_SECRET` lives in Render secret group `il-app-secrets`. To rotate: deploy with both old and new secrets accepted briefly (current implementation only honours one — change requires planned cron downtime in [secrets-management.md](secrets-management.md)).

## 6. Hashes for non-secret identifiers

| Use | Algorithm | Where |
|---|---|---|
| Refresh-token storage | SHA-256 | [`tokenService.ts:sha256`](../../api/src/services/tokenService.ts) |
| Invite/reset token storage | SHA-256 | [`api/src/services/inviteService.ts`](../../api/src/services/inviteService.ts) |
| Certificate stub URL | SHA-1 (truncated 16 hex chars) | [`certificateAdapter.ts:ConsoleCertificateAdapter`](../../api/src/integrations/certificateAdapter.ts) — dev/test only |

SHA-1 is acceptable for the dev stub because the value is purely identification, not security. The live `CertifierIoAdapter` does not use SHA-1.

## 7. Random number generation

`node:crypto` `randomBytes` is used everywhere a token, jti, or nanoid alternative is needed. We do not call `Math.random()` for any security-sensitive value.

## 8. Encryption at rest

- **MongoDB Atlas:** AES-256, KMS-backed by Atlas. Cluster-level only — we do not currently use Client-Side Field-Level Encryption (CSFLE).
- **Cloudinary:** Authenticated resources, AES-256 at rest by Cloudinary. Signed download URLs are TTL-bounded (5 min default — [`storageAdapter.ts`](../../api/src/integrations/storageAdapter.ts)).
- **Render disk:** No persistent disk in this deployment topology — every deploy is ephemeral and pulls fresh from the build artifact.

What is **not** encrypted at the field level:

- `User.address`, `User.phoneE164`, `User.email` (free-text and indexed columns).
- `Ticket.description` and `TicketComment.body` (often contain personal narrative).
- `AuditLog.before` / `after` JSON (rich PII).

For Phase 1 the at-rest baseline (Atlas) is judged sufficient. Field-level encryption is a Phase 2 candidate, particularly for ticket free-text — see [../compliance/data-classification.md](../compliance/data-classification.md).

## 9. CSRF posture

Mutating endpoints require an `Authorization: Bearer …` header. Because the access token is not a cookie, a cross-site form submit cannot include it. The only cookie-bearing routes are `/v1/auth/refresh` and `/v1/auth/logout`, and both are `SameSite=strict`. Net effect: there is no CSRF surface that requires explicit anti-CSRF tokens.

## 10. PII in logs

- Pino structured logger never receives `passwordHash`, `passwordHistoryHashes`, or full request/response bodies by default.
- Audit-log scrubber strips the same fields from before/after diffs ([`auditService.ts:scrubUser`](../../api/src/services/auditService.ts)).
- Sentry is configured at sample rate 0.1 with default scope — request bodies are not sent.

Reviewer checklist when adding logs: never log `req.body`, never log the access or refresh token, never log `passwordHash`. The lint target `npm run lint` will not catch this — code review is the gate.

## 11. Cryptographic agility

Decisions we have *not* taken yet but should be cheap to retrofit:

- Migrate JWT to RS256 once a relying party other than the SPA appears.
- Add CSFLE for `User.address` and `Ticket.description` if the data classification gets sensitive.
- Move `JOB_SECRET` to a key-versioned scheme so rotation is zero-downtime.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release; immediate review on any Argon2 / JWT / TLS upgrade._
