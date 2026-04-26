# Known Security Issues

This document tracks every security-relevant finding we know about and have not yet remediated, the rationale for accepting the residual risk, and the planned mitigation. It is updated as part of the release process.

If a finding here is exploited in the wild, treat it as a Sev 0 incident per [incident-response-plan.md](incident-response-plan.md) §1.

## 1. Open dependency advisories

Run `npm audit --omit=dev` from repo root to compare against the latest. As of 26 April 2026:

| Advisory | Severity | Package | Path | Affects production? | Acceptance |
|---|---|---|---|---|---|
| GHSA-67mh-4wv8-2f99 | moderate | `esbuild` ≤ 0.24.2 | `web/` (transitive via `vite`) | **No** — dev server CORS bypass; only relevant when running `vite dev` locally | Accepted; will resolve when Vite ships an esbuild 0.25+ pin |
| GHSA-5c6j-r48x-rmvq | high | `serialize-javascript` ≤ 7.0.4 | `web/` (transitive via `workbox-build` → `vite-plugin-pwa`) | **No** — affects build-time only; output bundles are not compromised | Accepted; tracked for vite-plugin-pwa update |
| GHSA-qj8w-gfj5-8c6v | high | `serialize-javascript` ≤ 7.0.4 | same as above | **No** — same reason | Accepted; same upgrade path |

Production runtime dependencies (api/) — `argon2`, `cloudinary`, `cookie-parser`, `cors`, `express`, `express-rate-limit`, `helmet`, `jose`, `mongoose`, `pdfkit`, `pino`, `zod` — currently have **zero known advisories** at the pinned versions in [`api/package.json`](../../api/package.json).

## 2. Architectural residuals (carried into Phase 1)

These are intentional Phase-1 decisions, each accepted with a planned mitigation window.

| ID | Issue | Risk | Acceptance rationale | Phase 2 plan |
|---|---|---|---|---|
| KI-001 | No multi-factor authentication | Single-factor login is a known foothold class | Phase 1 user base is ≤ 30 students per class; LUC mandates email-based identity. MFA is a Phase 2 candidate aligned with Logan's roadmap. | Add TOTP MFA for `admin`, `superadmin`, `finance` roles; opt-in for `faculty` and `student`. |
| KI-002 | No field-level encryption for free-text PII (`User.address`, `Ticket.description`, `TicketComment.body`, `AuditLog.before/after`) | Atlas-managed encryption-at-rest is the only barrier between an Atlas snapshot leak and these fields | Atlas encrypts at rest with KMS-backed keys; PII volume is bounded; complaint tickets are the most sensitive bucket and are owned only by `admin`/`finance` | Evaluate CSFLE for `Ticket` collection in Phase 2 |
| KI-003 | No anti-virus scanning on uploads | Malicious files could be served to staff downloading attachments | Cloudinary detects obvious binary anomalies; uploaders are authenticated users; download URLs are TTL-bounded | Add ClamAV or commercial scanner gating before signed download URL is issued |
| KI-004 | GET-query zod validation is partial | Some list endpoints accept loosely-typed query params | Mongoose typecasts; potential for slow queries via crafted regex but not for data exposure | Audit every list route for explicit query schemas; tracked as a code-side TODO |
| KI-005 | Fees-suspension whitelist duplicated in two files | New whitelisted route forgotten in one file silently differs in behaviour | Documented in [access-control.md](access-control.md) §3; review checklist in [secure-sdlc.md](secure-sdlc.md) catches it | Centralise whitelist definition and import from a single module |
| KI-006 | No CAPTCHA on login | Distributed slow-rate credential stuffing is possible | Per-(IP, email) rate limit + 30-min lockout after 10 failures provides reasonable friction; no live evidence of stuffing in current telemetry | Add hCaptcha or equivalent if Sentry/log review shows distributed patterns |
| KI-007 | Most non-auth routes are not rate-limited | High-volume scraping or enumeration is possible by an authenticated insider | Render edge throttling provides a coarse upper bound; insiders are audit-logged | Add per-route rate limiters for high-cardinality list endpoints |
| KI-008 | `JOB_SECRET` rotation requires planned downtime | Rotating mid-day briefly fails crons | `requireJobAuth` accepts only one secret; rotation is rare and crons are idempotent | Move to N+1 secret acceptance for zero-downtime rotation |
| KI-009 | No "logout everywhere" UI affordance | Users cannot self-serve a kill of all sessions; only password change/reset triggers it | The function `revokeAllForUser` exists but is not exposed via UI. Docs guide users to change password if they suspect compromise | Add a settings-page button that calls `revokeAllForUser` for the current user |
| KI-010 | Sentry sample rate is fixed at 0.1 | Could miss errors in low-volume incidents or oversubscribe in high-volume incidents | Manual adjust possible via env redeploy | Replace with adaptive sampling once event volume justifies |

## 3. Code-side TODOs that are security-adjacent

`grep -nE "TODO\|FIXME" api/src` returns these as of 26 April 2026 (audit them when reading this doc):

- _(none currently flagged in code; checklist on every PR per [secure-sdlc.md](secure-sdlc.md))_

## 4. Deprecation candidates

- `BREVO_API_KEY` env var is wired but the live `BrevoEmailAdapter` is rarely used. If Phase 1 settles on Resend + SendGrid, remove the Brevo branch from [`emailAdapter.ts`](../../api/src/integrations/emailAdapter.ts) to reduce surface.

## 5. How this list is updated

- Every PR that introduces a known limitation **must** add an entry here with an ID `KI-NNN`.
- Every PR that resolves an entry **must** remove or strikethrough it (with a date).
- `npm audit` is reviewed weekly during the build phase; entries in §1 update on each review.
- Entries that have been carried for > 6 months without progress are escalated to LUC leadership for a re-decision.

## 6. Public-facing reporting

This file is **not** public. The summary (without specifics that would aid an attacker) is reflected in:

- [SECURITY.md](SECURITY.md) — what is in/out of scope.
- [pentest-readiness-checklist.md](pentest-readiness-checklist.md) §6 — recommended focus areas (mirror these residuals).

If a finding here is later exploited or independently discovered, we publish a sanitised summary as part of the post-mortem under `/docs/post-mortems/`.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: every release._
