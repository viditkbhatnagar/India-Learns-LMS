# Vendor Risk Register

Every external service that processes India Learns data on our behalf — a "subprocessor" under the DPDP Act 2023 and the GDPR. This register lists what data each receives, where they store it, the security posture they advertise, the contractual baseline (DPA), and our internal mitigations.

The register is reviewed every quarter and on any change of subprocessor. A subprocessor cannot be added without an entry here.

## Format

For each vendor:

- **Service:** what we use it for.
- **Data shared:** the categories of personal data sent to them.
- **Region(s):** where they store / process the data.
- **Adapter:** the file in our codebase that implements the interface.
- **Toggle:** the env-var that selects this vendor (so we can disable in seconds).
- **Certifications:** attestations they advertise (SOC 2, ISO 27001, GDPR, etc.).
- **DPA status:** whether we have a Data Processing Agreement in place.
- **Breach contact:** how to reach them in an incident.
- **Alternative:** the standby vendor if we have to fail over.
- **Mitigations on our side:** what we've done to limit blast radius.
- **Residual risk:** what we accept.

---

## V1 — MongoDB Atlas

| Field | Value |
|---|---|
| **Service** | Managed MongoDB cluster — primary data store for the entire application |
| **Data shared** | All collections (see [ropa.md](ropa.md)) — identity, fees, tickets, audit, etc. |
| **Region(s)** | AWS `ap-south-1` (Mumbai) — chosen for DPDP § 16 alignment |
| **Adapter** | Native Mongoose driver — `api/src/config/db.ts` |
| **Toggle** | `MONGODB_URI` env (no fallback — this is the database of record) |
| **Certifications** | SOC 2 Type II, ISO 27001, ISO 27018, ISO 27017, HIPAA-eligible, PCI-DSS Level 1 |
| **DPA status** | MongoDB Inc. publishes a standard DPA — countersign required before launch |
| **Breach contact** | https://www.mongodb.com/cloud/security |
| **Alternative** | Self-hosted MongoDB (operationally heavy); not Phase 1 |
| **Mitigations** | Cluster-level encryption at rest (KMS); DB user scoped to app DB; URI in Render secret group; no direct shell access for staff |
| **Residual** | Atlas operator has theoretical access to data; covered by their certifications |

## V2 — Render

| Field | Value |
|---|---|
| **Service** | Hosting for the API + SPA web service and the 5 cron jobs |
| **Data shared** | Full request/response transit (decrypted at edge), env secrets in their secret-group manager |
| **Region(s)** | Singapore (closest to Mumbai Atlas region) |
| **Adapter** | Configured by [`render.yaml`](../../render.yaml) |
| **Toggle** | n/a — host platform |
| **Certifications** | SOC 2 Type II; HIPAA-eligible (BAA available) |
| **DPA status** | Render publishes a DPA — countersign required before launch |
| **Breach contact** | security@render.com |
| **Alternative** | Fly.io, Railway, AWS App Runner |
| **Mitigations** | Same-origin deploy means no cross-site cookies; secrets group is private; build artifacts ephemeral |
| **Residual** | Render operator has theoretical access to env secrets; covered by their certifications |

## V3 — Cloudinary

| Field | Value |
|---|---|
| **Service** | Binary storage — receipt PDFs, course materials, ticket attachments |
| **Data shared** | Files (some contain PII — receipts include name/address/financials); folder paths derived from purpose |
| **Region(s)** | Configurable per Cloudinary account; default US-region |
| **Adapter** | [`api/src/integrations/storageAdapter.ts:CloudinaryStorageAdapter`](../../api/src/integrations/storageAdapter.ts) |
| **Toggle** | `STORAGE_PROVIDER=cloudinary` (alternative `stub` keeps assets on-process for tests) |
| **Certifications** | SOC 2 Type II, ISO 27001, ISO 27018, GDPR-aligned |
| **DPA status** | Cloudinary publishes a DPA — countersign required before launch |
| **Breach contact** | security@cloudinary.com |
| **Alternative** | AWS S3 + signed URLs; Backblaze B2; Vercel Blob |
| **Mitigations** | `type: authenticated` resources only; signed download URLs with 5-min default TTL; per-environment account |
| **Residual** | Asset bucket region may be US — flagged for cross-border transfer documentation in [dpdp-compliance-report.md](dpdp-compliance-report.md) §1 (§ 16) |

## V4 — Resend

| Field | Value |
|---|---|
| **Service** | Transactional email (primary when `EMAIL_PROVIDER=resend`) |
| **Data shared** | Recipient email + name, subject, HTML/text body, optional tag |
| **Region(s)** | US |
| **Adapter** | [`emailAdapter.ts:ResendEmailAdapter`](../../api/src/integrations/emailAdapter.ts) |
| **Toggle** | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` |
| **Certifications** | SOC 2 Type II, GDPR-aligned |
| **DPA status** | Available on request — required before launch |
| **Breach contact** | https://resend.com/security |
| **Alternative** | SendGrid (configured fallback) |
| **Mitigations** | API key in Render secret group; 10-second per-call timeout; no full request body in error logs |
| **Residual** | US transit; provider sees recipient + body |

## V5 — SendGrid

| Field | Value |
|---|---|
| **Service** | Transactional email — primary when selected, fallback when primary is Resend or Brevo |
| **Data shared** | Same as Resend |
| **Region(s)** | US |
| **Adapter** | [`emailAdapter.ts:SendGridEmailAdapter`](../../api/src/integrations/emailAdapter.ts) |
| **Toggle** | `EMAIL_PROVIDER=sendgrid` OR `SENDGRID_API_KEY` set as fallback |
| **Certifications** | SOC 2 Type II, ISO 27001, GDPR-aligned, HIPAA-eligible |
| **DPA status** | Twilio-published DPA — countersign required |
| **Breach contact** | security@sendgrid.com |
| **Alternative** | Resend |
| **Mitigations** | Same as Resend |
| **Residual** | Same as Resend |

## V6 — Brevo

| Field | Value |
|---|---|
| **Service** | Transactional email when `EMAIL_PROVIDER=brevo` |
| **Data shared** | Same as Resend |
| **Region(s)** | EU (France-default) |
| **Adapter** | [`emailAdapter.ts:BrevoEmailAdapter`](../../api/src/integrations/emailAdapter.ts) |
| **Toggle** | `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` |
| **Certifications** | ISO 27001, GDPR (EU-resident company) |
| **DPA status** | Standard DPA published by Brevo |
| **Breach contact** | privacy@brevo.com |
| **Alternative** | Resend, SendGrid |
| **Mitigations** | Same as Resend |
| **Residual** | Currently underused; deprecation candidate per [../security/known-issues.md](../security/known-issues.md) §4 |

## V7 — Meta WhatsApp Business (Cloud API)

| Field | Value |
|---|---|
| **Service** | Templated WhatsApp messages (timetable changes, fee reminders, certificate availability) |
| **Data shared** | Recipient E.164 phone, template name + variables (may include name and amount) |
| **Region(s)** | Meta global infrastructure |
| **Adapter** | [`whatsappAdapter.ts:MetaWabaAdapter`](../../api/src/integrations/whatsappAdapter.ts) (live wiring scheduled M4/M5) |
| **Toggle** | `WHATSAPP_ENABLED=true` (default off — falls back to console adapter) |
| **Certifications** | Meta publishes ISO 27001 + 27017 + 27018 + 27701, SOC 2 Type II for Meta Business Platform |
| **DPA status** | Meta DPA via Business Platform terms |
| **Breach contact** | https://www.facebook.com/business/help — security category |
| **Alternative** | SMS provider (out of Phase 1 scope) |
| **Mitigations** | Disabled by default; templates pre-approved by LUC ops; per-message rate limit at the application layer |
| **Residual** | Currently disabled; when enabled, Meta sees recipient phone + template values |

## V8 — Certifier.io

| Field | Value |
|---|---|
| **Service** | Issuance of verifiable diploma/course credentials |
| **Data shared** | Student name, email, course name, completion date, idempotency key |
| **Region(s)** | US |
| **Adapter** | [`certificateAdapter.ts:CertifierIoAdapter`](../../api/src/integrations/certificateAdapter.ts) |
| **Toggle** | `CERTIFIER_ENABLED=true` (default off — falls back to deterministic stub URL) |
| **Certifications** | SOC 2 (per Certifier marketing) |
| **DPA status** | Required before launch |
| **Breach contact** | https://certifier.io/security (placeholder; obtain in vendor onboarding) |
| **Alternative** | Server-side PDF certificate generation via pdfkit (functional but no public verification URL) |
| **Mitigations** | Disabled by default; idempotency key prevents duplicate issuance |
| **Residual** | Currently disabled; when enabled, Certifier holds credential metadata |

## V9 — Sentry

| Field | Value |
|---|---|
| **Service** | Error and performance monitoring |
| **Data shared** | Stack traces, request URLs (which may contain IDs), HTTP method/status, environment metadata, user agent. Bodies are NOT sent. |
| **Region(s)** | Sentry SaaS (US default; EU optional per project) |
| **Adapter** | `api/src/config/sentry.ts`, `web/src/lib/sentry.ts` |
| **Toggle** | `SENTRY_DSN` set / unset |
| **Certifications** | SOC 2 Type II, ISO 27001, GDPR, CCPA |
| **DPA status** | Sentry DPA available; countersign required |
| **Breach contact** | security@sentry.io |
| **Alternative** | Self-hosted Sentry; OpenTelemetry to a private collector |
| **Mitigations** | Sample rate 0.1; default scrubber on; no body capture |
| **Residual** | URL paths may include identifiers |

---

## Quarterly review checklist

For each vendor, every quarter:

1. Confirm DPA is in force (not expired).
2. Check the vendor's status page and incident history for the prior quarter.
3. Re-read their public security posture and check for downgrades.
4. Verify our adapter's failure handling still matches their API.
5. Confirm we haven't increased the data scope beyond what's listed here.

## Adding a new vendor

1. Add a row here with all fields filled.
2. Update [ropa.md](ropa.md) processing activity if it represents a new flow.
3. Update [data-classification.md](data-classification.md) if the vendor receives a new category.
4. Update [../legal/privacy-policy.md](../legal/privacy-policy.md) subprocessor list.
5. Get the DPA countersigned before going live.
6. Add a kill-switch (env toggle) so we can turn the vendor off in seconds.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO). Review cadence: quarterly._
