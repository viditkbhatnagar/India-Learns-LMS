# Data Processing Agreement (Template)

> **PRE-PUBLISH NOTICE.** This is a TEMPLATE for use in two scenarios:
>
> 1. **Vendor-side DPA** — to be countersigned with our subprocessors so we satisfy DPDP § 8(1).
> 2. **Reseller / B2B-client DPA** — to be offered when LUC or another B2B client uses India Learns to deliver education to a third-party population.
>
> This template MUST be reviewed and adapted by qualified legal counsel before execution. Placeholders are listed in [PLACEHOLDERS.md](PLACEHOLDERS.md).

**Effective date:** {{EFFECTIVE_DATE}}

This Data Processing Agreement ("**DPA**") is entered into between:

- **{{ORG_NAME}}**, with registered office at {{ORG_REGISTERED_ADDRESS}} ("**India Learns**"); and
- **[Counterparty Name]**, with registered office at **[Counterparty Address]** ("**Counterparty**").

The Parties have entered into a service agreement (the "**Principal Agreement**") and now wish to set out their respective obligations regarding the processing of personal data.

## 1. Definitions

Capitalised terms have the meanings given in the Digital Personal Data Protection Act, 2023 of India ("**DPDP Act**") and, where applicable, in the EU General Data Protection Regulation 2016/679 ("**GDPR**"). In summary:

- "**Data Fiduciary** / **Controller**" — the entity that determines the purpose and means of processing.
- "**Data Processor**" — an entity that processes personal data on behalf of the Fiduciary / Controller.
- "**Data Principal** / **Data Subject**" — the natural person whose personal data is processed.
- "**Personal Data**" — any data about an identifiable individual.

## 2. Roles

Specify which role each Party assumes for which processing activity. Use one of the following matrices:

### 2.1 Vendor-side variant

When India Learns engages the Counterparty as a subprocessor (e.g., Cloudinary, Resend):

- India Learns is the **Data Fiduciary**.
- Counterparty is the **Data Processor**.

### 2.2 Reseller / B2B variant

When India Learns provides services to a B2B client (e.g., LUC) who in turn delivers education to data principals:

- The B2B client is the **Data Fiduciary**.
- India Learns is the **Data Processor**.

The remainder of this DPA assumes a Data Processor relationship between India Learns (or Counterparty) and the Fiduciary; clauses are written symmetrically and apply to whichever party is the Processor.

## 3. Subject matter and duration

| Item | Value |
|---|---|
| Subject matter | Processing of personal data necessary to deliver the services described in the Principal Agreement |
| Duration | The duration of the Principal Agreement plus any residual processing required for legal or accounting purposes |
| Nature and purpose | Hosting / file storage / email delivery / WhatsApp delivery / error monitoring / certificate issuance / analytics / etc. — as applicable |
| Categories of Data Principals | Students, faculty, administrative staff, finance staff |
| Categories of Personal Data | Identity, contact, role, enrolment, financial, support, technical metadata — as applicable |

Detail per processing activity is captured in the Fiduciary's [Records of Processing Activities](../compliance/ropa.md).

## 4. Obligations of the Processor

The Processor agrees to:

1. **Process only on documented instructions** from the Fiduciary, including for transfers to a third country, unless required to do so by law (in which case the Processor will inform the Fiduciary in advance unless the law prohibits such notice).
2. **Ensure confidentiality** — persons authorised to process the Personal Data are bound by confidentiality.
3. **Implement appropriate technical and organisational measures** to ensure a level of security appropriate to the risk, including those described in §5.
4. **Engage subprocessors only with prior written authorisation** from the Fiduciary (general or specific) and only under a written contract that imposes obligations no less protective than this DPA. The Processor remains liable for the acts of its subprocessors.
5. **Assist the Fiduciary** in fulfilling its obligations to respond to Data Principal rights requests, including access, correction, erasure, portability, and objection.
6. **Assist the Fiduciary** with security, breach notification, DPIAs, and prior consultation with regulators.
7. **Notify the Fiduciary** without undue delay (and in any event within 24 hours) on becoming aware of a personal data breach.
8. **Delete or return** all Personal Data at the choice of the Fiduciary at the end of services, unless retention is required by law.
9. **Make available** all information necessary to demonstrate compliance and **allow audits** (including inspections by the Fiduciary or a mandated auditor) on reasonable notice.

## 5. Security measures

The Processor implements at minimum:

- TLS in transit and AES-256 (or equivalent) at rest.
- Strong authentication for administrative access (with MFA).
- Role-based access control following the principle of least privilege.
- Logging and monitoring of access to Personal Data with retention sufficient to investigate incidents.
- Secure software development lifecycle including code review and dependency management.
- Regular vulnerability scanning and timely patching.
- Tested incident response plan.
- Personnel security including background checks and confidentiality undertakings.

For India Learns' technical measures, see [../security/threat-model.md](../security/threat-model.md), [../security/cryptography.md](../security/cryptography.md), and [../security/access-control.md](../security/access-control.md).

## 6. Subprocessors

| Name | Service | Region | DPA in place |
|---|---|---|---|
| _List per [vendor-risk-register.md](../compliance/vendor-risk-register.md)_ | | | |

Notification of intended changes — at least **30 days** before adding or replacing a subprocessor. The Fiduciary may object on reasonable grounds; if no resolution, the Fiduciary may terminate the affected service.

## 7. International transfers

Transfers outside India are permitted under DPDP § 16 except to countries notified by Central Government as restricted. The Processor maintains a current list of transfers in [vendor-risk-register.md](../compliance/vendor-risk-register.md) and re-evaluates each notification.

For transfers to subjects in the EU/EEA/UK that are processed under the GDPR, the Processor implements Standard Contractual Clauses (or equivalent transfer mechanism) where required.

## 8. Personal data breach

In the event of a personal data breach affecting data processed under this DPA:

1. The Processor notifies the Fiduciary without undue delay and within 24 hours.
2. The notification includes: nature, categories and approximate number of Data Principals affected, categories and approximate number of records, likely consequences, measures taken or proposed.
3. The Processor cooperates with the Fiduciary's regulator notification process per DPDP § 8(6).

## 9. Audit rights

The Fiduciary may audit the Processor's compliance with this DPA on **reasonable prior notice**, no more than **once per calendar year** absent a confirmed breach. The Fiduciary may rely on independent third-party audit reports (SOC 2, ISO 27001) to satisfy this obligation. Both parties bear their own costs.

## 10. Liability

Liability for breach of this DPA is governed by the limits set in the Principal Agreement, except that any cap that would limit a party's liability for a personal data breach below the statutory minimum required by applicable law is disregarded.

## 11. Term and termination

This DPA takes effect on the Effective Date and continues for the duration of the Principal Agreement. Either party may terminate this DPA on **30 days'** notice if the other materially breaches a clause and fails to remedy within 15 days of being notified.

## 12. Order of precedence

If there is a conflict between this DPA and the Principal Agreement, this DPA prevails on data protection matters.

## 13. Governing law and jurisdiction

This DPA is governed by the laws of {{GOVERNING_LAW}}. Disputes are subject to the exclusive jurisdiction of the courts at {{JURISDICTION_COURTS}}, except where required otherwise by applicable law.

## 14. Counterparts and execution

This DPA may be executed in counterparts. Electronic signature with timestamped server-side record has the same legal effect as a handwritten signature.

---

**For India Learns:**

| Field | Value |
|---|---|
| Name | _____________________ |
| Title | _____________________ |
| Date | _____________________ |
| Signature | _____________________ |

**For Counterparty:**

| Field | Value |
|---|---|
| Name | _____________________ |
| Title | _____________________ |
| Date | _____________________ |
| Signature | _____________________ |

---

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with LUC legal. Review cadence: annually + on every counterparty engagement._
