# Security Policy

India Learns is operated by {{ORG_NAME}} on behalf of Learners' University College (LUC). We take the security of student, staff, and financial data seriously. This document explains how to report a vulnerability, what is in scope, what to expect, and our coordinated-disclosure commitments.

> **Reporting address (placeholder):** `{{SECURITY_EMAIL}}` — see [../legal/PLACEHOLDERS.md](../legal/PLACEHOLDERS.md). Until a dedicated address is provisioned, send reports to `intern@learnerseducation.com` with subject prefix `[SECURITY]`.

## Supported versions

| Version | Status | Notes |
|---|---|---|
| `main` (production) | ✅ Supported | All security fixes land here first. |
| `release/*` tags | ✅ Supported (most recent two) | Critical fixes are back-ported. |
| Branches other than `main` | ❌ Unsupported | Pre-merge work; any vulnerabilities should be flagged on the PR, not via this channel. |

## In scope

- The deployed application at `{{WEBSITE_URL}}` (production) and any signed-link Render preview environments shared with you in writing.
- Source code in this repository — `api/`, `web/`, `packages/shared-types/`, `scripts/`, `render.yaml`, `.github/workflows/`.
- Authentication, session, refresh-token, and cookie flows (see [cryptography.md](cryptography.md)).
- HMAC-signed cron endpoints under `/v1/jobs/*` (see [`api/src/middleware/requireJobAuth.ts`](../../api/src/middleware/requireJobAuth.ts)).
- Server-side input handling, file uploads, and signed-URL flows for Cloudinary uploads (see [`api/src/integrations/storageAdapter.ts`](../../api/src/integrations/storageAdapter.ts)).
- Audit-log integrity (see [`api/src/services/auditService.ts`](../../api/src/services/auditService.ts)).
- Receipt-PDF generation and any logic that emits PII (see [`api/src/services/receiptService.ts`](../../api/src/services/receiptService.ts)).

## Out of scope

- Findings against third-party providers (MongoDB Atlas, Render, Cloudinary, Resend, SendGrid, Brevo, Meta WhatsApp, Certifier.io, Sentry). Report those to the vendor; we'll triage upstream coordination if you need help.
- Denial-of-service tests against production. Reach out before any load testing.
- Findings dependent on the absence of features that we have publicly de-scoped from Phase 1 (no payment gateway, no MFA, no SMS — see [../../claude-code-docs/01_BRD.md](../../claude-code-docs/01_BRD.md) §6).
- Spam, social engineering, or physical-security attacks.
- Vulnerabilities in dev-only build tooling that cannot affect production runtime (see [known-issues.md](known-issues.md) for current accepted-risk items).

## How to report

Send a single email containing:

1. A concise description of the vulnerability and the impacted asset.
2. Reproduction steps (smallest possible, ideally a curl one-liner or a screen capture).
3. Your assessment of severity and any sensitive data observed.
4. The handle you'd like credited (or "anonymous").

Do **not** include PII obtained during testing in the email body. If a report depends on real records, send hashes or sample IDs and we will coordinate transfer over a secure channel.

PGP/GPG: a key fingerprint will be published at `{{WEBSITE_URL}}/.well-known/security.txt` once the production domain is provisioned. Until then, plain email is acceptable for any non-critical finding; for findings rated High or above, please request a Signal channel in your initial mail.

## What to expect

| Step | Target |
|---|---|
| Acknowledgement | Within **2 business days** (India Standard Time, business days Mon–Fri) |
| Initial severity & validation | Within **5 business days** |
| Mitigation rollout for High/Critical | **≤ 14 calendar days** from validation |
| Mitigation rollout for Medium | **≤ 60 calendar days** from validation |
| Coordinated public disclosure | Mutually agreed; default **90 calendar days** from validation |

If we cannot meet a target we will tell you why and propose a revised date.

## Safe harbor

We will not pursue civil action or report to law enforcement against researchers who:

- Make a good-faith effort to avoid privacy violations and service disruption.
- Only interact with accounts they own or have explicit written permission to access.
- Do not exfiltrate, retain, or disclose data beyond what is necessary to demonstrate the vulnerability.
- Give us a reasonable time to remediate before public disclosure.

If your testing is consistent with this policy, we consider your activity authorised under the Indian Information Technology Act, 2000 (and the DPDP Act 2023) and will defend you against good-faith claims arising from such testing.

## Hall of fame

Researchers who help us materially are acknowledged here once a fix has shipped (and with their permission):

| Date | Researcher | Issue (one-line) | Severity |
|---|---|---|---|
| _Empty_ | | | |

## Related documents

- [threat-model.md](threat-model.md) — what we already protect against.
- [pentest-readiness-checklist.md](pentest-readiness-checklist.md) — recommended scope for paid engagements.
- [incident-response-plan.md](incident-response-plan.md) — what happens after a confirmed breach.
- [known-issues.md](known-issues.md) — current accepted-risk items.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (vendor lead). Review cadence: every release._
