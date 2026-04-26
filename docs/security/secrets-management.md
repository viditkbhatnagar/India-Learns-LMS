# Secrets Management

This document is the canonical inventory of secrets in India Learns: what they are, where they live, who can read them, how often they are rotated, and what to do when one leaks.

## 1. Storage model

In production, **all secrets live in a single Render environment-variable group called `il-app-secrets`**. The `il-app` web service and the five cron jobs all import from that group. See [`render.yaml`](../../render.yaml).

In development, secrets live in a local `api/.env` file (gitignored) seeded from [`api/.env.example`](../../api/.env.example). The example file contains *only* dev-default values — never real keys. Production refuses to boot if it sees the dev defaults — see [`api/src/config/env.ts:assertProdSecrets`](../../api/src/config/env.ts).

## 2. Inventory

The schema below is generated from [`api/src/config/env.ts`](../../api/src/config/env.ts). Every value in production must be set explicitly.

### 2.1 Hard secrets (refusing to boot in prod with defaults)

| Name | Purpose | Min size | Rotation | Owner |
|---|---|---|---|---|
| `JWT_SECRET` | Signs HS256 access tokens | 32 chars | **Annually** or on suspected leak | Vidit |
| `JOB_SECRET` | HMAC-signs cron requests to `/v1/jobs/*` | 32 chars | On staff turnover or leak | Vidit |
| `MONGODB_URI` | Atlas connection string with username + password | n/a | On role change or leak (Atlas console) | Vidit |

These three are blockers — without them, the app does not start.

### 2.2 Provider secrets (per-integration)

| Name | Purpose | Used by | Rotation |
|---|---|---|---|
| `RESEND_API_KEY` | Primary email when `EMAIL_PROVIDER=resend` | [`emailAdapter.ts`](../../api/src/integrations/emailAdapter.ts) | Per Resend policy / on staff change |
| `SENDGRID_API_KEY` | Email fallback (always when set, primary when `EMAIL_PROVIDER=sendgrid`) | `emailAdapter.ts` | Per SendGrid policy / on staff change |
| `BREVO_API_KEY` | Email when `EMAIL_PROVIDER=brevo` | `emailAdapter.ts` | Per Brevo policy / on staff change |
| `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | Storage uploads, signed URLs | [`storageAdapter.ts`](../../api/src/integrations/storageAdapter.ts) | Annually / on leak |
| `META_WABA_PHONE_ID` + `META_WABA_ACCESS_TOKEN` | WhatsApp Business templated messages (when `WHATSAPP_ENABLED=true`) | [`whatsappAdapter.ts`](../../api/src/integrations/whatsappAdapter.ts) | Per Meta token TTL (60 days for short-lived; long-lived requires re-issue) |
| `CERTIFIER_API_KEY` | Certificate issuance via Certifier.io (when `CERTIFIER_ENABLED=true`) | [`certificateAdapter.ts`](../../api/src/integrations/certificateAdapter.ts) | Per Certifier policy |
| `SENTRY_DSN` + `VITE_SENTRY_DSN` | Error monitoring (server + client) | `api/src/config/sentry.ts`, `web/src/lib/sentry.ts` | On project re-creation |

### 2.3 Configuration values that aren't secret but that gate behaviour

| Name | Purpose |
|---|---|
| `EMAIL_PROVIDER` | `resend\|sendgrid\|brevo\|stub` selector |
| `STORAGE_PROVIDER` | `cloudinary\|stub` selector |
| `WHATSAPP_ENABLED` | Boolean — flips between live `MetaWabaAdapter` and `ConsoleWhatsAppAdapter` stub |
| `CERTIFIER_ENABLED` | Same as above for certificate issuance |
| `INTEGRATIONS_MODE` | `stub\|live` master switch — `stub` overrides every integration to the console adapter |
| `RECEIPT_ORG_NAME` / `RECEIPT_ORG_ADDRESS` / `RECEIPT_ORG_GSTIN` / `RECEIPT_LOGO_URL` | Surfaced on receipt PDFs (PENDING from Logan — see [../legal/PLACEHOLDERS.md](../legal/PLACEHOLDERS.md)) |
| `LOGIN_RATE_*`, `PASSWORD_RESET_RATE_*` | Rate-limit knobs |
| `ARGON2_*` | Argon2id cost parameters |
| `INVITE_TOKEN_TTL_DAYS`, `RESET_TOKEN_TTL_MIN`, `SESSION_CAP` | Token / session lifetimes |
| `RATE_LIMITS_DISABLED` | Test-only — must be `false` in production |
| `LOG_LEVEL`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT` | Observability |
| `GIT_SHA` | Set by CI / Render — surfaced on `/healthz` |
| `SERVE_WEB_FROM` | Path to web/dist for single-service deploys |
| `WEB_ORIGIN`, `API_ORIGIN`, `COOKIE_DOMAIN`, `COOKIE_SECURE` | Cookie/CORS scoping |

### 2.4 Web env

| Name | Purpose |
|---|---|
| `VITE_API_BASE` | Where the SPA POSTs (same-origin in production) |
| `VITE_APP_ORIGIN` | Self-reference |
| `VITE_SENTRY_DSN` | Browser error reporting |
| `VITE_ENABLE_PWA` | Toggle vite-plugin-pwa |

The web env is baked into the bundle at build time. Anything injected here is *public* by definition — only put DSN-style values that can leak.

## 3. Who can read what

| Role | Render secret group | Atlas console | Cloudinary console | Resend / SendGrid / Brevo |
|---|---|---|---|---|
| Vidit (vendor lead) | ✅ | ✅ | ✅ | ✅ |
| Logan (LUC technical owner) | ✅ (read-only after first deploy) | ✅ (DB-user only) | ❌ | ❌ |
| Rejin (LUC operations) | ❌ | ❌ | ❌ | ❌ |
| Anyone else | ❌ | ❌ | ❌ | ❌ |

Practical implication: no secret should ever appear in chat, email, screenshots, Notion docs, or commit logs. If you see one, treat it as leaked and rotate.

## 4. Rotation procedures

### 4.1 `JWT_SECRET`

Effect of rotation: every active access token becomes invalid. Refresh tokens still work because they're verified against DB hash, so users get rolled to fresh tokens on next refresh.

1. Generate a new 64-byte secret: `openssl rand -base64 64 | tr -d '\n'`.
2. In Render → Environment → `il-app-secrets` → update `JWT_SECRET`.
3. Trigger a redeploy of `il-app` (no separate downtime needed; users will see one auto-refresh).
4. Audit-check: the next 10 minutes of `auth.login.success` and `auth.refresh` should look normal (no spike of 401s beyond expected).

### 4.2 `JOB_SECRET`

Effect: cron jobs will start failing as soon as either side rotates. The current `requireJobAuth` accepts only one secret, so this requires synchronised rotation.

1. Pick a quiet 5-minute window outside cron schedules (none of `0 3 * * *`, `0 22 * * *`, `*/15 * * * *`, `30 3 * * 1` should fire).
2. Update `JOB_SECRET` in `il-app-secrets`.
3. Redeploy `il-app`. The cron jobs auto-redeploy with the new secret.
4. Verify the next cron run logs `job.success` (Pino).

A future hardening will accept N+1 secrets to allow zero-downtime rotation.

### 4.3 `MONGODB_URI`

This embeds an Atlas DB-user password.

1. Atlas → Database Access → Edit user → rotate password.
2. Update `MONGODB_URI` in `il-app-secrets` with the new password.
3. Redeploy `il-app`.
4. Watch `/healthz` and Pino `mongo.connected` for one minute.

### 4.4 Provider keys

Each provider has its own UI. Update the corresponding env var, redeploy. None of these are blocking — failures degrade to logged warnings (e.g., email send failures retry via the M8 cron `il-cron-notifications-retry`).

## 5. Leak response

Treat any of the following as a leak:

- A secret was committed to the repo (even if force-pushed away).
- A secret appeared in chat, email, ticket, screenshot, or external paste.
- Render audit shows a secret-group read by an unrecognised account.
- A provider raised an alert that the key was used from an unexpected IP.

**Within 30 minutes:**

1. Rotate the affected secret per §4.
2. If `JWT_SECRET` was leaked: after rotation, additionally call `revokeAllForUser` for every active session if the leak suggests real-time abuse — the simplest way is `db.refreshtokens.updateMany({ revokedAt: null }, { $set: { revokedAt: new Date() } })`.
3. If `MONGODB_URI` was leaked: rotate Atlas DB-user password, then check Atlas access logs for connections from unexpected IPs in the leak window.
4. If a provider key was leaked: revoke at the provider, then rotate.

**Within 24 hours:**

5. Open an incident under [incident-response-plan.md](incident-response-plan.md) §3.
6. Determine impact (data accessed? records changed?) and decide on user notification per DPDP §8(6) — see [../compliance/dpdp-compliance-report.md](../compliance/dpdp-compliance-report.md).
7. Audit how the leak happened and add a regression-prevention checklist item to [secure-sdlc.md](secure-sdlc.md).

## 6. What goes in `.env.example` vs what doesn't

✅ Acceptable in `.env.example` (committed):

- Variable names and structure.
- Dev defaults that are explicitly rejected in production (`change-me-dev-only`).
- Comments describing the variable.
- Empty values for opt-in integrations.

❌ Never in `.env.example`:

- Real API keys, even revoked ones.
- Real Atlas connection strings.
- Real Render URLs that expose internal endpoints.
- Production webhook URLs.

If you see anything in §❌ above in a commit, immediately escalate per §5.

## 7. Local development hygiene

- Keep `api/.env` out of git (already in `.gitignore`).
- Do not paste your dev keys into AI tools or shared scratchpads.
- Stub adapters (`INTEGRATIONS_MODE=stub`) are the safe default in dev — you don't need real keys for almost any feature work.
- If you must wire a real provider in dev, use a per-developer key, not the production key.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: every quarter and after every leak event._
