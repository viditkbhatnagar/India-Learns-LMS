# SOC 2 Readiness — Gap Analysis

A self-assessment of India Learns against the AICPA Trust Services Criteria (TSC). The intent is to:

1. Communicate to LUC and prospective B2B clients where we stand without a full external audit.
2. Direct engineering effort to the highest-leverage controls.
3. Pre-empt the "do you have SOC 2?" conversation with evidence and a plan.

This document is **not** a SOC 2 attestation — only an external CPA firm can produce that. It is an honest scorecard.

> **Trust Service Categories assessed:** Common Criteria (CC1–CC9), Availability (A1), Confidentiality (C1), Privacy (P). Processing Integrity (PI) is not asserted in this baseline.

## How to read this document

Each criterion has:

- **Status** — Met / Partial / Gap.
- **Evidence** — citation to a code path, a doc, or an external system.
- **Owner** — who closes the gap if Partial / Gap.

A maturity rating is then summarised per category at the end of each section.

---

## CC1 — Control environment

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC1.1 Integrity and ethical values demonstrated | Partial | Vendor and LUC operate under written contracts; no published code of conduct yet | LUC + Vidit |
| CC1.2 Board / oversight present | Partial | LUC senior management exercises oversight via Logan / Rejin; vendor side is single-person | LUC |
| CC1.3 Authority and responsibility assigned | Met | [../security/incident-response-plan.md](../security/incident-response-plan.md) §2 names IC, comms lead, scribe | Vidit |
| CC1.4 Competent personnel attracted, developed, retained | Partial | Solo vendor + LUC ops; no formal training plan | LUC |
| CC1.5 Accountability for internal control responsibilities | Met | Audit log + per-doc owner attribution | Vidit |

**Maturity:** Partial — adequate for a small vendor + single-client deployment, would need formal HR controls for a larger team.

---

## CC2 — Communication and information

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC2.1 Information necessary for control objectives is identified | Met | This pack + [ropa.md](ropa.md) | Vidit |
| CC2.2 Information communicated internally | Met | `memory/` directory + commit-tied milestone reports per CLAUDE.md §10 | Vidit |
| CC2.3 Information communicated externally | Partial | [../legal/privacy-policy.md](../legal/privacy-policy.md) drafted; not yet on public site | LUC |

**Maturity:** Partial.

---

## CC3 — Risk assessment

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC3.1 Specifies suitable objectives | Met | [01_BRD.md](../../claude-code-docs/01_BRD.md) success metrics | Logan |
| CC3.2 Identifies and analyses risk | Met | [dpia.md](dpia.md), [../security/threat-model.md](../security/threat-model.md) | Vidit |
| CC3.3 Considers fraud potential | Partial | Audit log + payment reversal procedure; no specific anti-fraud controls beyond that | Finance + Vidit |
| CC3.4 Identifies and analyses significant change | Met | [../operations/change-management.md](../operations/change-management.md) | Vidit |

**Maturity:** Partial.

---

## CC4 — Monitoring activities

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC4.1 Selects and develops control activities | Met | This pack | Vidit |
| CC4.2 Considers external events | Partial | Quarterly vendor review; quarterly DPDP gazette check | Vidit |

**Maturity:** Partial.

---

## CC5 — Control activities

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC5.1 Selects and develops control activities | Met | Per-feature DoD in [CLAUDE.md](../../CLAUDE.md) §6 | Vidit |
| CC5.2 Selects technology controls | Met | [../security/secure-sdlc.md](../security/secure-sdlc.md) | Vidit |
| CC5.3 Deploys policies and procedures | Met | This pack | Vidit |

**Maturity:** Met for the size of the operation.

---

## CC6 — Logical and physical access controls

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC6.1 Logical access restricted | Met | Auth + RBAC + owner check | [../security/access-control.md](../security/access-control.md) |
| CC6.2 New / modified access requires authorisation | Met | Admin issues invites; superadmin role-edit gate | Code |
| CC6.3 Removes access when no longer needed | Met | `revoked` status; `revokeAllForUser` | Code |
| CC6.4 Restricts physical access to facilities | n/a | No facilities; cloud-only | n/a |
| CC6.5 Discontinued physical media handling | n/a | None | n/a |
| CC6.6 Restricts external system access | Met | CORS allowlist + Bearer auth | Code |
| CC6.7 Restricts movement of information | Partial | Subprocessor controls but no DLP | Vidit |
| CC6.8 Manages credentials | Met | Argon2id + history + reuse check + rate limit + lockout | Code |

**Maturity:** Met (with the noted MFA exception).

---

## CC7 — System operations

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC7.1 Detect security events | Partial | Sentry + Pino + audit log; no SIEM | Vidit |
| CC7.2 Monitor system components | Met | `/healthz`, Sentry, Render dashboard | [../operations/monitoring-and-alerting.md](../operations/monitoring-and-alerting.md) |
| CC7.3 Evaluate and respond to events | Met | [../security/incident-response-plan.md](../security/incident-response-plan.md) | Vidit |
| CC7.4 Recover from incidents | Met | Same + [../operations/backup-and-dr.md](../operations/backup-and-dr.md) | Vidit |
| CC7.5 Identify, develop, and implement change activities | Met | CI + branch protection plan in [../security/secure-sdlc.md](../security/secure-sdlc.md) | Vidit |

**Maturity:** Partial — no SIEM aggregation across logs.

---

## CC8 — Change management

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC8.1 Change tracked and authorised | Met | Git + CI + PR review | Code |
| CC8.2 Documented procedures | Met | [../operations/change-management.md](../operations/change-management.md) | Vidit |

**Maturity:** Met.

---

## CC9 — Risk mitigation

| Control | Status | Evidence | Owner |
|---|---|---|---|
| CC9.1 Vendor and business partner risks | Met | [vendor-risk-register.md](vendor-risk-register.md) | Vidit |
| CC9.2 Vendor / partner agreements | Partial | DPAs in flight | Vidit + LUC |

**Maturity:** Partial.

---

## A1 — Availability

| Control | Status | Evidence | Owner |
|---|---|---|---|
| A1.1 Capacity, performance monitored | Partial | Render dashboard; no formal SLO targets yet | Vidit |
| A1.2 Backup and recovery | Met | [../operations/backup-and-dr.md](../operations/backup-and-dr.md) | Vidit |
| A1.3 Recovery testing performed | Gap | Restore drill not yet executed | Vidit |

**Maturity:** Partial.

---

## C1 — Confidentiality

| Control | Status | Evidence | Owner |
|---|---|---|---|
| C1.1 Identifies confidential information | Met | [data-classification.md](data-classification.md) | DPO |
| C1.2 Protects confidential information | Met | Encryption-at-rest + auth + audit | [../security/cryptography.md](../security/cryptography.md) |

**Maturity:** Met (with field-level encryption gap noted).

---

## P — Privacy

| Control | Status | Evidence | Owner |
|---|---|---|---|
| P1.1 Notice provided | Partial | Privacy policy drafted; not on the live site | LUC + Vidit |
| P2.1 Consent obtained | Met | Per-channel notification consent | Code |
| P3.1 Collection limited | Met | Minimal data collection — no Aadhaar / DoB at signup | [ropa.md](ropa.md) |
| P4.1 Use limited | Met | RBAC and purpose-bound services | Code |
| P5.1 Access | Partial | DSAR procedure documented; self-service pending | DPO |
| P6.1 Disclosure | Met | Subprocessor list public via privacy policy | LUC |
| P7.1 Quality | Met | Self-edit + correction flows | Code |
| P8.1 Monitoring and enforcement | Met | DPO oversight + audit log | DPO |

**Maturity:** Partial — strong technical posture, formal artefacts catching up.

---

## Summary scorecard

| Category | Met | Partial | Gap |
|---|---|---|---|
| CC1 Control environment | 1 | 4 | 0 |
| CC2 Communication | 2 | 1 | 0 |
| CC3 Risk assessment | 3 | 1 | 0 |
| CC4 Monitoring | 1 | 1 | 0 |
| CC5 Control activities | 3 | 0 | 0 |
| CC6 Access controls | 6 | 1 | 0 |
| CC7 System operations | 4 | 1 | 0 |
| CC8 Change management | 2 | 0 | 0 |
| CC9 Risk mitigation | 1 | 1 | 0 |
| A1 Availability | 1 | 1 | 1 |
| C1 Confidentiality | 2 | 0 | 0 |
| P Privacy | 5 | 2 | 0 |

**Highlights:**

- ✅ Strong technical foundation — CC5, CC6, CC8, C1 fully met.
- ⚠️ Formalisation gaps — written code of conduct, formal SLOs, restore drills.
- ❌ One full gap — recovery testing (A1.3). Closing this is a one-day exercise per [../operations/backup-and-dr.md](../operations/backup-and-dr.md).

## Plan to close gaps

| Gap | Action | Target |
|---|---|---|
| A1.3 — restore drill not executed | Run restore drill against staging from a 7-day-old backup; document timing | Before July launch |
| CC1.1 — written code of conduct | Adopt the LUC code of conduct as the project's; cross-link in [legal/acceptable-use-policy.md](../legal/acceptable-use-policy.md) | Pre-launch |
| CC9.2 — DPAs not all countersigned | Sequence: Atlas → Render → Cloudinary → Resend → SendGrid → Brevo → Sentry | Pre-launch |
| P1.1 — notice not yet on live site | Wire privacy policy link from invite-acceptance and login-page footer | M9 |
| P5.1 — DSAR self-service | Build access-export and erasure endpoints | Q3 2026 |
| CC7.1 — no SIEM | Decide whether Phase 2 needs aggregated logging beyond Sentry + Render logs | Phase 2 |

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO). Review cadence: quarterly + on every major control change._
