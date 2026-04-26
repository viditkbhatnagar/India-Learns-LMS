# Privacy Policy

> **PRE-PUBLISH NOTICE.** Placeholders in this document MUST be resolved and the document reviewed by qualified legal counsel before being made public. See [PLACEHOLDERS.md](PLACEHOLDERS.md).

**Effective date:** {{EFFECTIVE_DATE}}

This Privacy Policy explains how **{{ORG_NAME}}** ("**we**", "**us**") collects, uses, and shares your personal data when you use the India Learns learning management platform ("**Platform**") in support of diploma programmes offered by Learners' University College.

This policy is written for the **Digital Personal Data Protection Act, 2023** of India and aligns with the GDPR/UK GDPR for users in the EU/EEA/UK.

## 1. Who we are

The data fiduciary for your personal data is:

- **{{ORG_NAME}}**
- Registered office: {{ORG_REGISTERED_ADDRESS}}
- Data Protection Officer: {{DPO_NAME}}, {{DPO_EMAIL}}, {{DPO_PHONE}}

If you have questions about this policy or your rights, please contact the DPO.

## 2. Personal data we collect

We collect the categories of data listed below. Detailed records are maintained in our internal [Records of Processing Activities](../compliance/ropa.md).

### 2.1 Account and identity

- Name, email address, phone number (E.164), postal address.
- Role (student, faculty, admin, finance, superadmin).
- Programme and batch link.
- Account state, last-login timestamp, lockout metadata.
- A password hash (we never see your plaintext password).

### 2.2 Educational records

- Enrolment records (validity dates, programme).
- Course-progress data (which modules and sessions you have viewed).
- Assignment submissions, quiz attempts, exam attempts (including text answers you submit).
- Rubric feedback and grades.
- Course-completion status and issued certificates.

### 2.3 Financial records

- Invoices, fee instalments, payment records (method, reference, amount, dates).
- Receipt PDFs.

### 2.4 Support and grievance records

- Tickets you raise (subject, category, description, attachments).
- Comments on tickets.
- Notification delivery records (email, WhatsApp, in-app) and your preferences.

### 2.5 Technical and security data

- IP address, user-agent string, device identifier.
- Refresh-token metadata (hash, family identifier, lifecycle timestamps).
- Audit-log entries when you (as staff) make changes.
- Error events sent to our error-monitoring vendor.

We do **not** collect:

- Aadhaar, PAN, passport, or any other government identifier through the Platform.
- Date of birth at signup (LUC may capture this offline; we may add a self-declared field in a future release for minor-detection).
- Health, biometric, religious, sexual-orientation, or political-opinion data.
- Behavioural-tracking data (no watch-time, no scroll heatmaps, no cross-site cookies).

## 3. How we collect

- **From you** — when you complete your invitation, edit your profile, raise a ticket, take an assessment, or submit feedback.
- **From LUC** — when LUC's offline enrolment process triggers your invitation.
- **Automatically** — IP, user agent, device id, and audit metadata are captured when you interact with the Platform.

## 4. Lawful basis

| Activity | Lawful basis |
|---|---|
| Maintaining your Account, delivering courses, recording fees, issuing certificates | Performance of contract |
| Sending email and WhatsApp notifications | Your consent (per channel; you can opt out at any time) |
| Audit logging | Our legitimate interest in security, accountability, and dispute resolution |
| Retention of financial records | Legal obligation under Indian tax law |
| Error monitoring | Our legitimate interest in operating a secure and reliable service |

## 5. How we use personal data

We use your data to:

- Authenticate you and apply role-based access controls.
- Deliver the courses you are enrolled in.
- Schedule classes, manage attendance, and administer assessments.
- Bill you, record payments, and issue receipts.
- Generate certificates upon completion.
- Communicate timetable changes, fee dues, ticket updates, and certificate availability.
- Resolve grievances and respond to support requests.
- Operate, secure, monitor, and improve the Platform.
- Comply with legal and regulatory obligations.

We do **not** sell your personal data, and we do not use it for behavioural advertising.

## 6. Sharing of personal data

We share your data with:

### 6.1 Subprocessors

We engage carefully selected third parties to provide infrastructure and tooling. The current list — kept up to date in our [Vendor Risk Register](../compliance/vendor-risk-register.md) — is:

- **MongoDB Atlas** (Mumbai, India) — primary database.
- **Render** (Singapore) — hosting and cron.
- **Cloudinary** — binary file storage (receipts, materials, attachments).
- **Resend / SendGrid / Brevo** — transactional email.
- **Meta WhatsApp Business** — templated WhatsApp messages (when enabled).
- **Certifier.io** — issuance of public credentials (when enabled).
- **Sentry** — error monitoring.

Each subprocessor is bound by a Data Processing Agreement and is contractually limited to processing data on our instructions.

### 6.2 LUC

We share data with LUC because LUC is the academic provider of your Programme. LUC's processing of your data in its capacity as a separate education provider is governed by LUC's own privacy notice.

### 6.3 Legal and safety

We may disclose data when required by law, by a court order, or by a regulator; or when necessary to investigate fraud, protect rights, or ensure user safety.

### 6.4 Business transfers

If the Platform or its assets are sold, transferred, or merged with another entity, your data may be transferred. We will notify you in advance and, where required, obtain your consent.

## 7. International transfers

Some of our subprocessors operate outside India (e.g., Cloudinary, Resend, Certifier.io are typically US-based). The DPDP Act 2023 permits such transfers except to countries notified by the Central Government as restricted; we monitor that list and avoid restricted destinations. Each subprocessor implements security measures equivalent to those required of us.

## 8. Retention

We retain your data only as long as needed for the purposes described above and to comply with legal obligations. Specific retention periods per data category are in our [Data Retention Policy](../compliance/data-retention-policy.md). In summary:

- Active account data — while your Account is active.
- Account data after revocation — 90 days, then anonymisation.
- Financial records (invoices, payments, receipts) — 8 years.
- Audit logs — 7 years.
- Tickets — 7 years from final state.
- Refresh tokens — 14 days post-expiry.
- Notifications — 1 year.

## 9. Your rights

Under the DPDP Act 2023 and related laws, you have the right to:

- **Access** — obtain a summary of personal data we hold about you.
- **Correction** — have inaccurate or incomplete data corrected.
- **Erasure** — have your data deleted, subject to statutory retention.
- **Withdraw consent** — for any consent-based processing.
- **Grievance redressal** — raise a complaint with our DPO.
- **Nominate** — nominate another individual to exercise rights on your behalf in case of death or incapacity.

If you are an EU/EEA/UK user, you also have the rights to data portability, restriction of processing, and to object to processing based on legitimate interest.

To exercise any right, contact **{{DPO_EMAIL}}** or follow the procedure in our [DSAR Procedure](../compliance/dsar-procedure.md). We will respond within 15 working days.

If you are not satisfied with our response, you may complain to the **Data Protection Board of India** (or, if applicable, your local supervisory authority in the EU/UK).

## 10. Children

Most of our users are adults. If you are under 18, your parent or legal guardian must provide verifiable consent for you to use the Platform; LUC captures this offline before issuing your invitation. We do not engage in behavioural tracking, profiling, or targeted advertising directed at any user, irrespective of age.

If we learn that we have collected personal data from a child without verifiable consent, we will delete that data.

## 11. Security

We protect your data with industry-standard measures: TLS in transit, encryption at rest at our cloud database provider, Argon2id password hashing, role-based access control, audit logging, and rate-limited authentication. Detailed information is in our [Threat Model](../security/threat-model.md), [Cryptography](../security/cryptography.md), and [Access Control](../security/access-control.md) documents.

In the unlikely event of a personal data breach, we will notify the Data Protection Board of India and affected Data Principals as required by Section 8(6) of the DPDP Act, ordinarily within 72 hours of becoming aware of the breach. Our [Incident Response Plan](../security/incident-response-plan.md) governs this process.

## 12. Cookies

Our use of cookies is described in the [Cookie Policy](cookie-policy.md). In summary, we use only essential cookies — there are no analytics, advertising, or third-party cookies on the Platform.

## 13. Changes to this policy

We may update this policy from time to time. Material changes will be communicated by email and via an in-app notice at least **15 days** before they take effect. The "Effective date" at the top of this document indicates the latest revision.

## 14. Contact

For privacy questions, requests, or grievances:

- **Data Protection Officer:** {{DPO_NAME}}, {{DPO_EMAIL}}, {{DPO_PHONE}}
- **General support:** {{SUPPORT_EMAIL}}
- **Postal:** {{ORG_REGISTERED_ADDRESS}}

---

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO) with LUC legal. Review cadence: annually + on every change to subprocessors or processing activities._
