# Integrations

Every external service India Learns talks to, why, how the integration is wired, and how to swap or disable it. The authoritative source is [`api/src/integrations/`](../../api/src/integrations/).

## 1. The adapter pattern

Each external service has:

- **An interface** in `india-learns-shared-types` (e.g., `EmailAdapter`, `StorageAdapter`).
- **At least two implementations** — a stub for dev/test (`Console*Adapter` — logs to Pino) and one or more live implementations.
- **A factory** in [`api/src/integrations/index.ts`](../../api/src/integrations/index.ts) that picks the right implementation based on env at boot.

```ts
// /api/src/integrations/index.ts (illustrative)
export function getIntegrations(): Integrations {
  // ... reads env, picks adapter per integration
  return { email, emailFallback, whatsapp, storage, certificate };
}
```

Two important env knobs:

- **`INTEGRATIONS_MODE=stub`** — *master switch.* Forces every integration to its console stub. Useful for tests and incident isolation.
- **`<PROVIDER>_ENABLED=true`** or **`<TYPE>_PROVIDER=<name>`** — per-integration selectors.

## 2. Email — Resend / SendGrid / Brevo / stub

[`api/src/integrations/emailAdapter.ts`](../../api/src/integrations/emailAdapter.ts).

| Provider | Selector | Required env | Region |
|---|---|---|---|
| Resend | `EMAIL_PROVIDER=resend` | `RESEND_API_KEY` | US |
| SendGrid | `EMAIL_PROVIDER=sendgrid` | `SENDGRID_API_KEY` | US |
| Brevo | `EMAIL_PROVIDER=brevo` | `BREVO_API_KEY` | EU |
| Stub | `EMAIL_PROVIDER=stub` (or `INTEGRATIONS_MODE=stub`) | none | n/a |

### Failure handling

When the primary provider is **not** SendGrid and `SENDGRID_API_KEY` is set, the platform configures SendGrid as the fallback. `notificationService.sendEmailWithFallback` writes two entries to the cost ledger when the fallback wins, so you can see fallback invocations in analytics.

The adapter has a 10-second per-call timeout; non-2xx responses raise and bubble to the caller, which decides whether to retry (the `il-cron-notifications-retry` cron picks up failed notifications every 15 minutes).

### Sending an email programmatically

```ts
const { email } = getIntegrations();
await email.send({
  to: user.email,
  subject: 'Reset your India Learns password',
  html, text,
  tag: 'password-reset',
  vars: { name: user.name },
});
```

## 3. Storage — Cloudinary / stub

[`storageAdapter.ts`](../../api/src/integrations/storageAdapter.ts).

| Provider | Selector | Required env |
|---|---|---|
| Cloudinary | `STORAGE_PROVIDER=cloudinary` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Stub | `STORAGE_PROVIDER=stub` (default) | none |

### What we put on Cloudinary

| Folder | Contents |
|---|---|
| `il/pdf_receipts` | Receipt PDFs |
| `il/videos` | Course videos (when uploaded) |
| `il/course_materials` | Slide decks, PDFs |
| `il/assignments` | Student submissions |
| `il/tickets` | Ticket attachments |

All uploads use `type: 'authenticated'` so Cloudinary will not serve them publicly. Reads require a signed download URL (`signedUrl(key, ttlSec)`); default TTL **300 seconds**.

### Direct upload from the browser

For large files we use signed-upload tickets so bytes flow Browser → Cloudinary directly, never through the API:

1. SPA calls `/v1/storage/sign-upload` (role-scoped).
2. API calls `storageAdapter.signedUploadTicket({ folder, filename, contentType })` and returns the ticket.
3. SPA POSTs the file to the Cloudinary URL with the headers from the ticket.

## 4. WhatsApp — Meta WhatsApp Business / stub

[`whatsappAdapter.ts`](../../api/src/integrations/whatsappAdapter.ts).

| Provider | Selector | Required env |
|---|---|---|
| Meta WABA | `WHATSAPP_ENABLED=true` (and not stub mode) | `META_WABA_PHONE_ID`, `META_WABA_ACCESS_TOKEN` |
| Stub | `WHATSAPP_ENABLED=false` (default) | none |

The live `MetaWabaAdapter` is currently a placeholder that throws `MetaWabaAdapter not wired — scheduled for M4 / M5.` Live wiring is on the M4/M5 roadmap. Until then, the stub `ConsoleWhatsAppAdapter` logs the intended send to Pino with all variables visible.

Templates are pre-approved by LUC ops in the Meta Business Platform (per CLAUDE.md §3 / TRD §3).

## 5. Certificates — Certifier.io / stub

[`certificateAdapter.ts`](../../api/src/integrations/certificateAdapter.ts).

| Provider | Selector | Required env |
|---|---|---|
| Certifier.io | `CERTIFIER_ENABLED=true` (and not stub mode) | `CERTIFIER_API_KEY`, `CERTIFIER_DEFAULT_TEMPLATE_ID` |
| Stub | `CERTIFIER_ENABLED=false` (default) | none |

The stub returns a deterministic URL (`https://stub.indialearns.com/cert/<sha1-of-idempotency-key>`) so dev/test flows have a stable target.

The live adapter posts to `https://api.certifier.io/v1/credentials` with bearer auth and uses the enrolment id as the `idempotency-key` header so re-issues dedupe upstream. 10-second timeout.

## 6. Error monitoring — Sentry

`api/src/config/sentry.ts` (server) and `web/src/lib/sentry.ts` (web).

| Field | Value |
|---|---|
| Selector | `SENTRY_DSN` set |
| Required env | `SENTRY_DSN` (server), `VITE_SENTRY_DSN` (web), optional `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_ENVIRONMENT` |

Sentry is initialised at app boot ([`api/src/app.ts`](../../api/src/app.ts) calls `initSentry()`). When DSN is empty, the SDK is a no-op so dev/test require no setup.

## 7. Why the adapter pattern matters

- **Test isolation** — every integration test injects a stub via `setIntegrations(...)` so production keys never leak into CI.
- **Vendor swap** — moving from Resend to Brevo is one env change + one redeploy; no code change.
- **Incident control** — flipping `INTEGRATIONS_MODE=stub` immediately disables outgoing side-effects in case of a runaway loop or compromised provider key.
- **Cost tracking** — every adapter logs to `apiCostLedger` so we know what we're spending where.

## 8. Selecting at boot

```ts
const env = loadEnv();
const stub = env.INTEGRATIONS_MODE === 'stub';

const email: EmailAdapter = stub
  ? new ConsoleEmailAdapter()
  : env.EMAIL_PROVIDER === 'sendgrid'
    ? new SendGridEmailAdapter()
    : env.EMAIL_PROVIDER === 'resend'
      ? new ResendEmailAdapter()
      : env.EMAIL_PROVIDER === 'brevo'
        ? new BrevoEmailAdapter()
        : new ConsoleEmailAdapter();
```

## 9. Adding a new integration

1. Define the interface in `india-learns-shared-types`.
2. Implement a `Console*Adapter` (logger-only stub) and at least one live adapter under `api/src/integrations/`.
3. Add the env selector + key to [`api/.env.example`](../../api/.env.example) and [`api/src/config/env.ts`](../../api/src/config/env.ts).
4. Wire the factory in `integrations/index.ts`.
5. Update `getIntegrations()` consumers to use the new field.
6. Document:
   - In [../compliance/vendor-risk-register.md](../compliance/vendor-risk-register.md) (subprocessor record).
   - In [../compliance/ropa.md](../compliance/ropa.md) (processing activity).
   - Here.

## 10. Where to read more

- [system-overview.md](system-overview.md) §6 — adapter pattern in context.
- [../security/threat-model.md](../security/threat-model.md) §5 — third-party trust boundary.
- [../security/secrets-management.md](../security/secrets-management.md) — rotation policy per provider.
- [../compliance/vendor-risk-register.md](../compliance/vendor-risk-register.md) — DPA + region per vendor.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release that adds, removes, or replaces an integration._
