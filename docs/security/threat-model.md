# Threat Model

This document captures the trust boundaries of the India Learns deployment, the threats we model at each, the mitigations currently in place (verifiable in the source), and the residual risks we knowingly carry into Phase 1. It is intended to be read together with [access-control.md](access-control.md), [cryptography.md](cryptography.md), and [secrets-management.md](secrets-management.md).

We use STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) per boundary. "Mitigated" means the property is enforced in code today, with a citation. "Residual" means there is meaningful risk left after the mitigation, recorded for an explicit accept/treat decision.

---

## 1. System context

```mermaid
flowchart LR
    Student[Student / Faculty / Admin / Finance / Superadmin\nbrowser] -->|HTTPS| Render
    Cron[Render cron jobs\n(5 schedules)] -->|HTTPS + HMAC| Render
    Render[Render web service\nNode 20 — il-app.onrender.com\nExpress API + React SPA] -->|TLS| Atlas[(MongoDB Atlas\nMumbai ap-south-1)]
    Render -->|HTTPS| Cloud[Cloudinary]
    Render -->|HTTPS| Mail[Resend / SendGrid / Brevo]
    Render -->|HTTPS| WABA[Meta WhatsApp\n(stub by default)]
    Render -->|HTTPS| Cert[Certifier.io\n(stub by default)]
    Render -->|HTTPS| Sentry[Sentry]
```

Trust boundaries:

- **B1** — Browser ↔ Render web service.
- **B2** — Render cron ↔ Render web service (`/v1/jobs/*`).
- **B3** — Render web service ↔ MongoDB Atlas.
- **B4** — Render web service ↔ third-party providers (Cloudinary, mail, WhatsApp, Certifier, Sentry).
- **B5** — Browser ↔ Cloudinary (direct signed-upload flow).

Key code references:

- App wiring: [api/src/app.ts](../../api/src/app.ts)
- Auth: [api/src/middleware/auth.ts](../../api/src/middleware/auth.ts), [api/src/services/tokenService.ts](../../api/src/services/tokenService.ts), [api/src/services/authService.ts](../../api/src/services/authService.ts)
- Cron auth: [api/src/middleware/requireJobAuth.ts](../../api/src/middleware/requireJobAuth.ts)
- Adapters: [api/src/integrations/](../../api/src/integrations/)

---

## 2. Boundary B1 — Browser ↔ Render

**Assets crossing:** access tokens (Bearer header), refresh-token cookie (`__Host-il_rt`), all API request/response bodies, file uploads via signed Cloudinary URLs.

| STRIDE | Threat | Mitigation (in code) | Residual |
|---|---|---|---|
| **S** Spoofing | An attacker presents a forged JWT to impersonate a user. | HS256 JWT signed with `JWT_SECRET` ≥ 32 bytes (enforced in [`api/src/config/env.ts:assertProdSecrets`](../../api/src/config/env.ts)); `iss=il`, `aud=web` claims verified on every request. | If the secret leaks, all sessions are forgeable until rotation. See [secrets-management.md](secrets-management.md). |
| **S** | Refresh-token theft via XSS. | Refresh token is opaque, stored as SHA-256 hash in DB ([`api/src/services/refreshTokenService.ts`](../../api/src/services/refreshTokenService.ts)); the plaintext lives only in the `__Host-il_rt` cookie which is `httpOnly`, `Secure`, `SameSite=strict` ([`api/src/utils/cookies.ts`](../../api/src/utils/cookies.ts)). Access token is in JS memory and short-lived (15 min). | XSS on the SPA can still exfiltrate the in-memory access token for up to 15 minutes; mitigated by Helmet defaults and the absence of dangerously-set HTML. |
| **S** | Credential stuffing / brute force. | Login is rate-limited per (IP, email) at 5/15min and locks the account for 30 min after 10 consecutive failures ([`api/src/middleware/rateLimit.ts`](../../api/src/middleware/rateLimit.ts), `LOGIN_RATE_*` env). Password policy enforced server-side ([`api/src/services/passwordService.ts:validatePolicy`](../../api/src/services/passwordService.ts)). | No CAPTCHA — distributed credential stuffing across many IPs would not trigger the per-IP+email key. Reviewed quarterly; add CAPTCHA if seen in telemetry. |
| **T** Tampering | An attacker modifies a request mid-flight. | TLS terminates at Render; HSTS + standard secure headers via Helmet defaults ([`api/src/app.ts`](../../api/src/app.ts)). | None at this boundary if TLS holds. |
| **T** | Cookie tampering or downgrade. | `__Host-` prefix forces `Secure` + `Path=/` + no `Domain` (RFC 6265bis); browser drops modified cookies. | Only Phase-1 same-origin deploy: API and SPA share the Render URL ([`render.yaml`](../../render.yaml)). |
| **R** Repudiation | A staff user disputes a destructive action. | Every staff write goes through [`recordAudit`](../../api/src/services/auditService.ts) with actor, action, before/after, IP, UA, timestamp. Auth events logged for both success and failure — see [`authService.ts:login`](../../api/src/services/authService.ts). | Audit writes are non-blocking; if the AuditLog collection is unavailable, the request still succeeds (logged via Pino). Acceptable trade-off — full availability over completeness. |
| **I** Info disclosure | Listing other users' data via guessable IDs. | Auth + role gate on every route via [`requireAuth`](../../api/src/middleware/auth.ts) + [`requireRole`](../../api/src/middleware/requireRole.ts). Per-resource ownership checks live in services (e.g. `meCoursesRouter`, `meTicketsRouter`, `myFeesRouter` only return rows where the actor is the owner). | Service-layer ownership checks are not centralised; a missed check on a new route is the single largest non-trivial risk. Mitigated by code review checklist in [secure-sdlc.md](secure-sdlc.md). |
| **I** | Sensitive fields leaking via JSON. | `User.toJSON` strips `passwordHash`, `passwordHistoryHashes`, `loginFailCount`, `lockedUntil` ([`api/src/models/user.ts`](../../api/src/models/user.ts)). Audit-log scrubber (`scrubUser`) removes the same fields from before/after diffs. | None known. |
| **D** DoS | Body-size flooding. | Express JSON limit set to `1mb` ([`api/src/app.ts`](../../api/src/app.ts)). | Multipart uploads bypass this, but they go directly to Cloudinary via signed URLs — see B5. |
| **D** | Slowloris / connection exhaustion. | Render edge proxy handles connection management; Node accepts proxied requests. `trust proxy` is set so `req.ip` reflects the real client. | Single Render service in Phase 1; full regional outage affects everyone. Documented in [../operations/slas.md](../operations/slas.md). |
| **E** Elevation | A student calls an admin route. | Per-route `requireRole(...roles)` middleware ([`api/src/middleware/requireRole.ts`](../../api/src/middleware/requireRole.ts)). Status `pending` blocked from all routes; status `revoked` and soft-deleted users blocked at `requireAuth`; manual suspension hard-blocked; fees suspension whitelisted to a small route set. | Whitelist is encoded in two places (auth.ts and requireNotSuspended.ts) — see Tampering note in [access-control.md](access-control.md). |

---

## 3. Boundary B2 — Cron ↔ API (`/v1/jobs/*`)

**Assets:** payloads of the 5 cron jobs (fee reminders, autosuspend, SLA timers, faculty digest, notifications retry — see [`render.yaml`](../../render.yaml)).

| STRIDE | Threat | Mitigation | Residual |
|---|---|---|---|
| **S** | Forged job invocation. | HMAC-SHA256 over `rawBody + timestamp` with `JOB_SECRET`; constant-time comparison ([`api/src/middleware/requireJobAuth.ts`](../../api/src/middleware/requireJobAuth.ts)). | If `JOB_SECRET` leaks, the attacker can run any cron job out of band. Rotation procedure in [secrets-management.md](secrets-management.md). |
| **T** | Replay attack. | 5-minute replay window enforced by comparing `x-job-timestamp` to `Date.now()`. | Within the 5-minute window, a captured request can be replayed. Acceptable: cron handlers are idempotent (notifications dedupe by `notification.idempotencyKey`; suspension is a state convergence). |
| **R** | Job action attribution. | Audit entries written by job handlers carry `actorUserId: null` and `action` prefixed `system.` so they're distinguishable. | Acceptable. |
| **I** | Sensitive data in logs. | Job handlers log via Pino with structured fields; PII not logged in payloads (only IDs/counts). | Reviewer should grep before adding new log statements. |
| **D** | Schedule storm. | Schedules in [`render.yaml`](../../render.yaml) are sparse (daily / 15min). | A misconfigured schedule could overwhelm Atlas; documented in [../operations/change-management.md](../operations/change-management.md). |
| **E** | Job calling user-scoped routes. | Job auth and user auth are separate middleware stacks; no shared bypass. | None known. |

---

## 4. Boundary B3 — API ↔ MongoDB Atlas

**Assets:** every model in [`api/src/models/`](../../api/src/models/) — 39 collections.

| STRIDE | Threat | Mitigation | Residual |
|---|---|---|---|
| **S** | Stolen Atlas credentials. | `MONGODB_URI` lives in Render secret group `il-app-secrets` (sync: false in [`render.yaml`](../../render.yaml)). Atlas Database User scoped to the application database only. | Per-environment credentials, no shared dev/prod user; documented in [secrets-management.md](secrets-management.md). |
| **T** | NoSQL injection. | Server uses `zod` to parse every body POSTed to mutation routes; queries are constructed with typed values, never string interpolation. | Get-list endpoints accept query params that are not always zod-parsed (gap noted in [pentest-readiness-checklist.md](pentest-readiness-checklist.md)). |
| **R** | Direct DB writes bypassing audit. | Production DB User has read/write on the application DB only; humans are not given direct credentials. | An admin with Atlas console access *could* bypass audit; see [../compliance/soc2-readiness-gap-analysis.md](../compliance/soc2-readiness-gap-analysis.md) "Logical access" finding. |
| **I** | Encryption at rest. | Atlas-managed encryption at rest (AES-256, KMS-backed by Atlas). | No field-level encryption — for example, `User.address` and `Ticket.description` are stored in clear inside the database file. Acceptable for Phase 1 given Atlas's encryption-at-rest baseline; revisit before adding sensitive special-category data. |
| **I** | Snapshot exposure. | Atlas backups inherit cluster encryption. Restore-drill steps in [../operations/backup-and-dr.md](../operations/backup-and-dr.md). | None known. |
| **D** | Connection storm during cron. | Mongoose pool defaults; cron windows staggered. | Acceptable on the Render Standard plan. |
| **E** | Privilege escalation via DB role. | Application user is read/write app DB; admin DB is closed. | None known. |

---

## 5. Boundary B4 — API ↔ third-party providers

| Provider | Data shared | Mitigation | Residual |
|---|---|---|---|
| **Cloudinary** | Receipt PDFs, course videos, materials | Authenticated-resource type, private_download_url with TTL ([`storageAdapter.ts`](../../api/src/integrations/storageAdapter.ts)). API secret in env; signed upload tickets expire in 5 min by default. | A leaked Cloudinary key allows public-list of the namespace; rotation in [secrets-management.md](secrets-management.md). |
| **Resend / SendGrid / Brevo** | Recipient email, name, body, tag | One adapter live at a time; SendGrid is configured fallback; HTTPS POST with bearer auth and 10-second timeout ([`emailAdapter.ts`](../../api/src/integrations/emailAdapter.ts)). | Provider sees recipient address and email body. Acceptable as documented in [../compliance/vendor-risk-register.md](../compliance/vendor-risk-register.md). |
| **Meta WhatsApp** | Recipient E.164 phone, template name, vars | Disabled by default (`WHATSAPP_ENABLED=false`); ConsoleWhatsAppAdapter is a logger-only stub. Real adapter (`MetaWabaAdapter`) currently throws (M4/M5 wiring pending). | When enabled, Meta gets phone + template payload. Templates are pre-approved by LUC ops. |
| **Certifier.io** | Student name, email, course, completion date | Disabled by default (`CERTIFIER_ENABLED=false`); bearer auth, idempotency key = enrolment id ([`certificateAdapter.ts`](../../api/src/integrations/certificateAdapter.ts)). | Provider stores cert metadata. Acceptable for credentialing. |
| **Sentry** | Errors with redacted PII (Sentry-scope filters); request URLs | DSN in env; sample rate 0.1; never sends body content. | Some URL paths reveal IDs (e.g., `/v1/students/:id`); request review of Sentry scrubber list before scaling beyond 10% sample. |

---

## 6. Boundary B5 — Browser ↔ Cloudinary direct upload

**Why direct?** Receipts, course materials, and ticket attachments are uploaded directly to Cloudinary using a signed ticket from our API ([`storageAdapter.ts:signedUploadTicket`](../../api/src/integrations/storageAdapter.ts)) — Render never sees the bytes.

| STRIDE | Threat | Mitigation | Residual |
|---|---|---|---|
| **S** | Forged upload ticket. | Signature is computed server-side using `CLOUDINARY_API_SECRET`; client cannot mint one. | None at the API layer. |
| **T** | Upload of malicious content. | `resource_type: 'auto'` lets Cloudinary auto-classify; `type: 'authenticated'` keeps assets non-public. | We do not run AV scanning on uploads — accepted risk for Phase 1; flagged in [pentest-readiness-checklist.md](pentest-readiness-checklist.md) as a future control. |
| **I** | Listing assets without auth. | `private_download_url` with TTL is required to read uploaded assets; raw Cloudinary URLs return 401. | None known. |
| **D** | Upload flooding. | Each ticket is single-use and expires in 300s; minted from rate-limited routes. | Acceptable. |

---

## 7. Cross-cutting threats

- **Session fixation / refresh-token reuse** — covered by family revocation. If a refresh-token's hash is presented twice, the entire family is revoked ([`refreshTokenService.ts:rotateRefreshToken`](../../api/src/services/refreshTokenService.ts)). This is rare but high-value: it converts theft of a refresh token into an instant session kill the moment the legitimate user refreshes again.
- **Mass enumeration** — list endpoints page-limit by default; admin-only. Public endpoints (login/forgot password) return identical errors for "user not found" vs "wrong password" to avoid account enumeration.
- **Insecure direct object reference (IDOR)** — see B1 / Info disclosure. The single biggest non-trivial risk class; mitigated by the "owner-or-role" pattern in services and by review checklist.
- **CSRF** — refresh and logout cookies are `SameSite=strict`. Mutations require `Authorization: Bearer` header (JS-set, not cookie-set) so cross-site requests can't forge calls. Documented in [cryptography.md](cryptography.md).

---

## 8. Residual risks (consolidated)

These are the items we explicitly carry into Phase 1. Each has a tracking entry in [../compliance/soc2-readiness-gap-analysis.md](../compliance/soc2-readiness-gap-analysis.md) or a code-side TODO.

1. **No MFA.** All login is single-factor. Documented exception; will be revisited Phase 2.
2. **No field-level encryption** for `User.address`, `Ticket.description`, and other free-text PII fields. Atlas encryption-at-rest is the baseline.
3. **No anti-virus on uploads.** Cloudinary is trusted to detect obvious binary anomalies.
4. **GET-query zod validation is partial.** Some list/filter endpoints accept loosely-typed query params.
5. **Fees-suspension whitelist is duplicated** in `auth.ts` and `requireNotSuspended.ts`. A new whitelisted route must be added in both. Tracked in [access-control.md](access-control.md).
6. **No CAPTCHA.** Distributed slow-rate credential stuffing is not blocked.
7. **No rate limit on most routes.** Only login and password reset are rate-limited. Render's edge throttles abusive IPs but not per-route.
8. **Sentry sample rate is fixed.** No dynamic adjustment when traffic spikes.

---

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release + after every security finding._
