# DPDP Act 2023 — Compliance Report

The Digital Personal Data Protection Act, 2023 ("DPDP Act") governs the processing of digital personal data of individuals in India. India Learns processes personal data of students, faculty, and staff and is therefore a **Data Fiduciary** under the Act.

This document maps the Act's obligations to India Learns' implementation, identifies gaps, and lists the actions to close them. It is intended as the principal compliance evidence pack for an internal or regulator-facing review.

> **Effective date of the Act:** Phase notification expected during 2026; we have built to the published Act text. This document tracks DPDP Rules as they are notified.

> **Roles for this Act:**
> - **Data Fiduciary:** the entity that determines the purpose and means of processing → **{{ORG_NAME}}** (operating India Learns on behalf of LUC).
> - **Data Processor:** an entity that processes personal data on behalf of the Fiduciary → our subprocessors, see [vendor-risk-register.md](vendor-risk-register.md).
> - **Data Principal:** the individual whose personal data is being processed → students, faculty, staff.

## 1. Section-by-section mapping

### § 4 — Grounds for processing personal data

DPDP allows processing only for a **lawful purpose** with consent (§ 6) or for a **legitimate use** (§ 7).

| India Learns activity | Lawful basis claimed | Notes |
|---|---|---|
| Creating a student account from a LUC-issued enrolment | Performance of contract with LUC + legitimate use § 7(b) (provision of subsidised service by State / non-profit context, applicable depending on LUC status) | Captured in [ropa.md](ropa.md) |
| Sending notifications (email + WhatsApp) about courses, fees, classes | Consent (collected at enrolment) — consent is granular per-channel via NotificationPrefs | Toggle: `me/notification-prefs` route, [`notificationPrefsService.ts`](../../api/src/services/notificationPrefsService.ts) |
| Recording payments and issuing receipts | Performance of contract + statutory record-keeping under Indian tax law | Receipt PDFs generated server-side, archived |
| Audit logging of staff actions | Legitimate interest (security and accountability) | Cannot be opted out — legal obligation |
| Issuing certificates via Certifier.io | Performance of contract | Subject's name and email leave the platform |
| Error monitoring via Sentry | Legitimate interest (security & operations) | URL paths may include IDs — see [vendor-risk-register.md](vendor-risk-register.md) |

### § 5 — Notice

The Act requires a clear notice at or before collection. Our notice surfaces are:

- **At invite acceptance** — the [legal/privacy-policy.md](../legal/privacy-policy.md) link is shown on the "Accept invite" screen ([web/src/pages/AcceptInvitePage](../../web/src/pages/)). _Status: scheduled to be added during M9 polish._
- **At payment** — the receipt page links to the privacy policy.
- **At every login screen** — footer link to the privacy policy.

Action: ensure the privacy policy link is rendered on the invite-claim page before public launch (tracked in [user-guides/student-handbook.md](../user-guides/student-handbook.md) onboarding section).

### § 6 — Consent

| Requirement | Implementation |
|---|---|
| Consent is free, specific, informed, unconditional and unambiguous | Notification preferences are an explicit toggle per channel (email, WhatsApp), per category. The collection of identity data is part of contract acceptance, not optional consent. |
| Consent in plain language | Privacy policy is written in plain English; we plan a Hindi translation in Phase 2 — documented in [accessibility-statement.md](accessibility-statement.md) §Languages |
| Right to withdraw consent | NotificationPrefs allow per-channel withdrawal at any time; identity-data withdrawal is an erasure request — see [dsar-procedure.md](dsar-procedure.md) |
| Consent Manager (§ 6(7)) | Out of scope for Phase 1 — no Consent Manager has been notified by the Board yet |

### § 7 — Certain legitimate uses

We rely on:

- § 7(a) — performance of any function under any law
- § 7(b) — performance by the State (LUC may qualify; legal counsel input requested)
- Contract performance — implicit when student accepts enrolment

This is documented in [ropa.md](ropa.md) per processing activity.

### § 8 — General obligations of the Data Fiduciary

| Obligation | Status | Evidence |
|---|---|---|
| § 8(1) Be responsible for compliance, including for processors | ✅ | [vendor-risk-register.md](vendor-risk-register.md) tracks each subprocessor |
| § 8(2) Reasonable security safeguards | ✅ | [../security/threat-model.md](../security/threat-model.md), [../security/cryptography.md](../security/cryptography.md) |
| § 8(3) Cease retention when purpose served + business need ends | ⚠️ Partial | [data-retention-policy.md](data-retention-policy.md) defines policy; automated deletion not yet implemented for all collections |
| § 8(4) Accuracy and completeness | ✅ | Users edit their own profile; staff have UI to correct records |
| § 8(5) Notify the Board and affected principals of breach | ⚠️ Procedure documented; no automated breach detection beyond Sentry/audit | [../security/incident-response-plan.md](../security/incident-response-plan.md) §5.1 |
| § 8(6) Period of breach notification | ✅ Procedure | Same as above; 72-hour working interpretation |
| § 8(7) Publish DPO contact | ⚠️ Pending — DPO designation needed | [PLACEHOLDERS.md](../legal/PLACEHOLDERS.md) lists `{{DPO_NAME}}`, `{{DPO_EMAIL}}` |
| § 8(8) Establish grievance redressal | ⚠️ Tickets system serves as grievance channel; explicit "DPO complaint" subcategory not yet built | Added to [user-guides/admin-handbook.md](../user-guides/admin-handbook.md) M9 list |

### § 9 — Processing of children's personal data

The Act treats anyone under 18 as a child; processing requires verifiable parental consent and prohibits behavioural tracking and targeted advertising.

LUC's diploma programs are tertiary, so most learners are 18+, but **a student aged 17 is plausible** at intake. We do not currently collect date of birth at signup, so we cannot mechanically detect minors.

**Gap:** capture DoB at invite or first login; if < 18, route through parental-consent flow.
**Mitigation today:** LUC's enrolment process is offline and includes parental sign-off for minors, so the in-app consent gap does not represent unverified processing in practice. Documented in [user-guides/admin-handbook.md](../user-guides/admin-handbook.md).

### § 10 — Significant Data Fiduciary

The Board may notify a class of fiduciaries as "significant" based on volume + sensitivity + risk. India Learns at Phase 1 scale (≤ 30 students/class, projected 126 in first 30 days) is unlikely to qualify.

If notified later, we would need:

- DPO designation (Phase 2 candidate regardless).
- Independent data auditor.
- Periodic DPIA — see [dpia.md](dpia.md).

### §§ 11–14 — Rights and duties of Data Principals

| Right | India Learns implementation | Gap |
|---|---|---|
| § 11 Right to access summary | Documented procedure in [dsar-procedure.md](dsar-procedure.md); served by support staff producing a JSON export from each collection | Self-service endpoint not yet built |
| § 12 Right to correction and erasure | Profile editing UI for correction; erasure via support ticket per [dsar-procedure.md](dsar-procedure.md) | No "delete my account" button |
| § 13 Right to grievance redressal | Tickets system + escalation per [../user-guides/support-channels.md](../user-guides/support-channels.md) | Escalation path to Board is not yet documented to users |
| § 14 Right to nominate | Procedure documented; nomination captured by support staff | No UI |
| § 15 Duties (truthful info, no false complaints) | Surfaced in [../legal/acceptable-use-policy.md](../legal/acceptable-use-policy.md) | n/a |

### § 16 — Cross-border transfer

The Act allows transfer to any country except those notified by Central Government as restricted.

| Transfer | Destination | Justification |
|---|---|---|
| Email send via Resend / SendGrid / Brevo | US (most likely) — confirm per provider region | Operational necessity; subprocessor agreements |
| Storage in Cloudinary | Likely US-region account; configurable | Operational necessity |
| Sentry error events | Sentry SaaS US/EU | Operational necessity |
| Certifier.io | US-region | Operational necessity |

We have **no notified-restricted transfers** as of the latest gazette check, but we monitor this list quarterly.

### § 17 — Exemptions

Not relied upon — we treat all student data as personal data subject to the full Act.

## 2. Documented gaps and remediation plan

| Gap | Severity | Owner | Target |
|---|---|---|---|
| DPO designation pending | High (regulatory) | LUC | Before public launch (July 2026) |
| Privacy notice not yet linked from invite-acceptance screen | High | Vidit | M9 polish |
| Date-of-birth capture for minor detection | Medium | Vidit + LUC | M9 / first post-launch sprint |
| Self-service DSAR export endpoint | Medium | Vidit | Q3 2026 |
| Self-service erasure endpoint | Medium | Vidit | Q3 2026 |
| Automated retention enforcement | Medium | Vidit | Phase 2 |
| Hindi privacy policy translation | Low | LUC + LUC legal | Phase 2 |
| Field-level encryption for free-text PII | Low | Vidit | Phase 2 |

These are also tracked in `TASKS.md` at the repo root.

## 3. How to use this document

- **Internal review:** read top to bottom; confirm each section against the cited code path.
- **Auditor / regulator:** start with §1 mapping, cross-reference to [ropa.md](ropa.md) and [dpia.md](dpia.md), review §2 gap remediation plan, and verify the dated "Last reviewed" stamp.
- **Engineering:** when shipping a feature that processes new categories of personal data, update [ropa.md](ropa.md) first, [data-retention-policy.md](data-retention-policy.md) second, and this report third.

## 4. Related artefacts

- [ropa.md](ropa.md) — Records of Processing Activities
- [dpia.md](dpia.md) — Data Protection Impact Assessment
- [data-classification.md](data-classification.md) — what counts as PII vs sensitive PII
- [data-retention-policy.md](data-retention-policy.md) — retention schedule per collection
- [dsar-procedure.md](dsar-procedure.md) — rights-fulfilment workflow
- [vendor-risk-register.md](vendor-risk-register.md) — subprocessor list with DPA status
- [../security/incident-response-plan.md](../security/incident-response-plan.md) — breach-notification clock
- [../legal/privacy-policy.md](../legal/privacy-policy.md) — public-facing privacy notice

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO until designation). Review cadence: quarterly + on every notified DPDP Rule._
