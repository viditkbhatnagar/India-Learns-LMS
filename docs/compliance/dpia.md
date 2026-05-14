# Data Protection Impact Assessment (DPIA)

A Data Protection Impact Assessment is a structured exercise to identify, evaluate, and mitigate the risks that personal-data processing poses to individuals. This DPIA covers India Learns Phase 1 in its entirety; targeted DPIAs for new features should be appended.

This DPIA follows the structure recommended by the Indian Ministry of Electronics & Information Technology (MeitY) draft guidance and by analogous EU/UK ICO templates so an auditor familiar with either framework can navigate it.

> **Document status:** Phase 1 baseline DPIA, conducted 26 April 2026. Repeat before public launch (July 2026), and on any material change to processing activities or subprocessors.

## 1. Introduction and necessity test

### 1.1 What is being assessed

The end-to-end India Learns LMS — a Phase 1 web application + PWA delivering LUC's 300-hour Diploma Programmes (Aviation, Retail & Fashion). The system handles authentication, course delivery, fees, ticketing, assessments, certificates, and notifications. See [ropa.md](ropa.md) for the full activity catalogue.

### 1.2 Necessity and proportionality

| Question | Answer |
|---|---|
| Is the processing necessary to deliver the contracted service? | Yes — identity, enrolment, fees, scheduling, assessment, and credentials are intrinsic to the diploma offering |
| Is there a less-intrusive way to achieve the same purpose? | We minimise where reasonable: no SMS provider; no third-party analytics; no behavioural tracking. Watch-time and per-page tracking are explicitly out of scope per `CLAUDE.md` §3 |
| Is the data limited to what is needed? | Identity record collects only what LUC's offline enrolment captures; no DoB at signup, no Aadhaar/PAN, no payment-card data |
| Is consent appropriate or is contract performance the lawful basis? | Identity processing is contractual; channel-specific notifications are consent-based with per-channel opt-out |

## 2. Description of processing

### 2.1 Data flows

```mermaid
flowchart TB
    LUC[LUC offline enrolment] -->|invitation event| Admin[Admin UI]
    Admin --> Mongo[(MongoDB Atlas\nMumbai)]
    Student[Student] -->|HTTPS| App[India Learns API + SPA]
    App --> Mongo
    App --> Cloud[Cloudinary\n(materials, receipts, attachments)]
    App --> Email[Resend / SendGrid / Brevo]
    App --> WABA[Meta WhatsApp\n(stub default)]
    App --> Cert[Certifier.io\n(stub default)]
    App --> Sentry[Sentry]
    Faculty --> App
    Finance --> App
```

### 2.2 Categories of data and data principals

See [data-classification.md](data-classification.md) for the tier classification, and [ropa.md](ropa.md) for the categories per activity.

Summary:

- **Sensitive (Tier 1):** financial fields (invoice, payment, receipt), free-text complaint tickets, exam answer text, audit `before/after` diffs.
- **Personal (Tier 2):** name, email, E.164 phone, postal address, role, programme/batch link, lockout/login metadata.
- **Internal (Tier 3):** course catalogue, programme metadata, timetable rules, rubric definitions.
- **Public (Tier 4):** brand and marketing copy on the public website.

### 2.3 Lawful basis

| Activity bucket | Lawful basis |
|---|---|
| Identity, enrolment, fees, certificates | Performance of contract |
| Audit, security monitoring | Legitimate interest |
| Email and WhatsApp notifications | Consent (per-channel) |
| Tax-record retention | Legal obligation |

### 2.4 Special categories

The Act does not yet enumerate "sensitive" personal data the way the GDPR does. We currently process **no special categories** in the GDPR sense — no biometrics, no health, no religious belief, no sexual orientation, no political opinion. Free-text fields could in principle contain such information if a user volunteered it; there is no UI prompt for it.

### 2.5 Children's data

Phase 1 user base is expected to be predominantly 18+. The Act treats anyone under 18 as a child requiring verifiable parental consent. We do not yet capture date of birth. The mitigation today is that LUC's offline enrolment process collects parental sign-off for minors before invitation, so any minors processed by the system have already had verifiable consent collected externally. Captured as a gap in [dpdp-compliance-report.md](dpdp-compliance-report.md) §1 (§ 9 row).

## 3. Risk assessment

For each risk, we score:

- **Likelihood:** 1 (rare) – 5 (almost certain)
- **Severity:** 1 (negligible) – 5 (severe — financial loss, identity compromise, regulatory exposure)
- **Risk = L × S** before mitigation; we re-score after mitigation.

| # | Risk | L | S | L×S | Mitigation | Post-mitigation L×S |
|---|---|---|---|---|---|---|
| R1 | Account takeover via stolen password (credential stuffing) | 3 | 4 | 12 | Argon2id + rate limit + lockout + per-(IP,email) keying; documented in [../security/cryptography.md](../security/cryptography.md) | 2 × 4 = 8 |
| R2 | Refresh-token theft via XSS | 2 | 4 | 8 | `__Host-` httpOnly Secure SameSite=strict cookie; family revocation on reuse; Helmet CSP defaults | 1 × 4 = 4 |
| R3 | IDOR exposing another user's data | 3 | 4 | 12 | Owner check in services; review checklist; no centralised helper yet | 2 × 4 = 8 |
| R4 | Subprocessor breach (Cloudinary / mail provider) leaks PII | 2 | 4 | 8 | Vendor risk register; signed-URL TTLs; minimal PII in mail body | 2 × 3 = 6 |
| R5 | Mass enumeration of student emails | 3 | 3 | 9 | Generic error on auth failures; admin-only list endpoints; per-route rate-limit gap noted | 2 × 3 = 6 |
| R6 | Unauthorised admin action (compromised admin account) | 2 | 5 | 10 | MFA absent (KI-001); audit trail enables reversal; rate-limited login | 2 × 4 = 8 |
| R7 | Atlas snapshot leak | 1 | 5 | 5 | KMS-backed encryption at rest; restricted DB user | 1 × 4 = 4 |
| R8 | Receipt PDF leakage to unintended recipient | 2 | 3 | 6 | Signed-URL TTL of 5 minutes; finance-only issue path; audit per receipt | 1 × 3 = 3 |
| R9 | Notification mis-routing (wrong phone or email) | 2 | 3 | 6 | Server-side validation of E.164; manual checks in admin UI; in-app banner repeats critical info | 1 × 3 = 3 |
| R10 | Audit-log tampering by an insider with Atlas access | 1 | 5 | 5 | Atlas DB user is application-only; staff do not have direct shell access | 1 × 4 = 4 |
| R11 | Inability to fulfil a DSAR within DPDP timelines | 3 | 3 | 9 | Manual procedure documented in [dsar-procedure.md](dsar-procedure.md); self-service endpoint pending | 2 × 3 = 6 |
| R12 | Data retention beyond stated schedule | 3 | 3 | 9 | Retention policy documented; automated enforcement planned | 2 × 3 = 6 |
| R13 | Children's data processed without verifiable consent | 2 | 5 | 10 | Offline parental sign-off via LUC; in-app age capture pending | 1 × 5 = 5 |
| R14 | Cross-border transfer to a notified-restricted country | 1 | 4 | 4 | Quarterly Gazette check; subprocessors are major US/EU services | 1 × 4 = 4 |
| R15 | Sentry receiving sensitive URL fragments (PII in path) | 2 | 2 | 4 | Sample rate 0.1; default scrubber; SDK does not transmit body | 1 × 2 = 2 |

### Heat-map (post-mitigation)

```
Severity →
   5 │            R13
   4 │       R1 R3 R6
   3 │  R8 R9 R4 R5 R11 R12
   2 │  R15
   1 │
     └─────────────────────────
        1   2   3   4   5    Likelihood →
```

No residual risk lands above 8. The two highest (R1, R3, R6 at 8) are the focus areas in [../security/pentest-readiness-checklist.md](../security/pentest-readiness-checklist.md) §6.

## 4. Specific consultations

| Consulted party | Date | Notes |
|---|---|---|
| LUC product owner (Logan, Rejin) | ongoing | Embedded in product reviews |
| LUC legal | pending | Required for DPA template, terms-of-service language |
| External DPO | not yet appointed | Tracked in [dpdp-compliance-report.md](dpdp-compliance-report.md) §2 |
| Data Principals (sample student survey) | not yet conducted | Phase 2 candidate |

## 5. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Interim DPO | Vidit Bhatnagar | _digital sign-off via PR merge_ | 2026-04-26 |
| LUC Product Owner | Logan | _to be added_ | _pending_ |
| LUC Legal | _to be appointed_ | | |

## 6. Refresh schedule

This DPIA is refreshed on:

1. Every major release that introduces a new processing activity (per [ropa.md](ropa.md)).
2. Every change to a subprocessor list ([vendor-risk-register.md](vendor-risk-register.md)).
3. Annually as a calendar event regardless of changes.
4. After any breach — to capture lessons.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO). Next review: before July 2026 launch._

---

## 7. Admissions module (added 2026-05-14 with M1–M9 shipped)

The Admissions module introduces new PII categories at the prospective-student stage — before the data subject is a Student. This addendum captures the additional processing activities.

### 7.1 New PII fields captured

| Field | Where | Lawful basis | Retention |
|---|---|---|---|
| Legal first / middle / last name, preferred name | `applications` → `draft.data.step2_personal` | Consent (signup) | Application lifetime + 7 years per [data-retention-policy.md](data-retention-policy.md) |
| Date of birth | step2_personal | Consent + age-verification (18+ only) | Same |
| Citizenship, country of birth, primary language | step2_personal | Consent | Same |
| Gender identity | step2_personal (optional) | Consent | Same |
| Address (street + city + state + postal + country) | step3_contact | Consent | Same |
| Phone (mobile + alt), emergency contact | step3_contact | Consent | Same |
| Academic history (institution, dates, GPA, test scores) | step5_academic | Consent | Same |
| Government ID image (PDF/JPG/PNG) | `applicationdocuments` (Cloudinary `il/application-documents/*`) | Consent (explicit upload) | Application lifetime; **purged after 90 days if application stays in `draft` state** (M9 cleanup cron) |
| Prior transcript image | same | same | same |
| Resume / portfolio (if program requires) | same | same | same |
| Letter of recommendation (uploaded by referee) | same, plus `referees` row with referee name + email + organization | Referee implicit consent via the tokenized email link | same |
| Statement of purpose (long-text) | `applications.statement` | Consent | Same |
| Consents (FERPA notice, terms, prior-education-auth, comms) | `applications.consents.*` | Each consent timestamp + version stamped for proof | Lifetime of student record |

### 7.2 Risks and admissions-specific mitigations

| Risk | Mitigation |
|---|---|
| Applicant abandons mid-form — PII sits indefinitely | M9 `admissionsDraftCleanupJob` cron sweeps draft Applications + their documents/referees/tokens 90 days after last edit. Cloudinary objects deleted as part of the sweep. |
| Referee email contains plain-text tokenized URL | Tokens are SHA-256 hashed in Mongo. Plain token only in the email body. TTL 30 days, single-use, marked `usedAt` after upload. |
| Cloudinary breach exposes gov-ID images | Authenticated mode (signed-URL access only); no public URLs. Cloud account is per-environment with separate API keys. |
| Audit log tampering hides officer actions | `admissionsauditlogs` is service-layer append-only + per-row SHA-256 chain. M9 head-snapshot cron records the head hash off-row daily for external recomputation. |
| MFA not enforced on staff | M9 ships `mfaEnabled` + `mfaSecret` fields on User (data-shape only). Enforcement (TOTP verify on login) lands in M10+. Off by default. |
| FERPA enforcement gap | M4 captures `directoryFlags` + `ferpaAnnualAckAtUtc` on Application + User. Enforcement logic (3rd-party disclosure log per 34 CFR § 99.32, opt-out gate) is Phase 2 when US-market expansion happens. |

### 7.3 Subprocessors used by admissions

No new subprocessor is introduced — admissions reuses MongoDB Atlas (ap-south-1), Cloudinary, Resend (primary email) + SendGrid (fallback), and Sentry, all of which are already listed in [vendor-risk-register.md](vendor-risk-register.md).

### 7.4 Outstanding items before US-market FERPA enforcement

- Officer↔program scoping (currently any `admissions_officer` can view any application — Plan-agent risk #3 from `/Users/viditkbhatnagar/.claude/plans/users-viditkbhatnagar-downloads-applica-glittery-anchor.md`).
- Annual FERPA notification UI prompt + acknowledgement.
- Directory-information opt-out UI for students.
- 34 CFR § 99.32 disclosure log for any third-party PII disclosure.
- TOTP MFA enrolment + verify-on-login flow.
- Soft-delete flow for retracted applications.
