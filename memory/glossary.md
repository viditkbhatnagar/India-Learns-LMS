# Glossary — India Learns LMS

Acronyms and shorthand pulled from the doc pack. Update when new terms appear.

| Term | Meaning |
|---|---|
| **India Learns** | The product. (See decision D-001 — root CLAUDE.md says "India LearnHub", spec pack says "India Learns"; resolved to "India Learns".) |
| **LUC** | Client organisation, headquartered in Dubai (LUC DXB). Operates Diploma Programs in India. |
| **AGI LMS** | LUC's existing online LMS for MBA/standalone pathways. India Learns is the in-person classroom replacement, not a fork of AGI. |
| **Diploma Program** | The 300-hour in-person cohort programs at launch: Aviation, Retail & Fashion. |
| **Batch** | A cohort within a program. Max 30 students per batch. Has weekly recurring timetable, faculty coordinators, validity dates. |
| **WABA** | WhatsApp Business API (Meta Cloud). Three pre-approved templates at launch: `il_fee_due`, `il_payment_received`, `il_ticket_update`. Gated by `WHATSAPP_ENABLED`. |
| **DPDP Act** | India's Digital Personal Data Protection Act, 2023. BR-11 — minimise PII, audit access, support data export + deletion. |
| **Certifier.io** | Third-party SaaS that issues digital certificates. Behind `CertificateService` interface; stub adapter in dev. |
| **PWA** | Progressive Web App — installable from the browser. Native apps deferred to Phase 2. `vite-plugin-pwa` powers it. |
| **MERN** | MongoDB + Express + React + Node — the locked stack (TRD §3). |
| **Paise** | Indian sub-unit of rupee (₹1 = 100 paise). All money fields stored as integer paise in fields ending `Paise`. |
| **IST** | India Standard Time (UTC+5:30). Mongo stores UTC, UI displays IST via `date-fns-tz`. |
| **ap-south-1** | AWS Mumbai region — where MongoDB Atlas cluster lives, for DPDP Act alignment. |
| **M10** | Atlas tier at launch. |
| **Magic-link invite** | Onboarding flow — Admin creates account, system emails a single-use 7-day token, student sets password. No self-signup. |
| **Sandbox vs published** | Course states. Sandbox is editable; published is locked + version-incremented. `POST /v1/courses/:id/publish`. |
| **Sequential modules** | If `course.sequential = true`, modules unlock in order. |
| **Argon2id** | Password hashing algorithm. `timeCost=3, memoryCost=65536, parallelism=1`. |
| **Complaint precondition** | A Complaint ticket can only be raised if the student has at least one prior Resolved or Closed ticket — escalation-only. Server enforces, returns `COMPLAINT_PRECONDITION_UNMET`. |
| **Session cap** | Max 5 concurrent refresh tokens per user; oldest revoked on the 6th issuance. |
| **JOB_SECRET** | Separate secret used to sign cron-call JWTs (HS256, 5-min TTL, claim `iss:'render-cron'`). |
| **SLA breach** | Ticket past `slaAckDeadline` (24h) or `slaResolveDeadline` (5d, or 15 business days for Complaints). |
| **Auto-suspend** | Student access blocked 14 days after installment due date if unpaid. Two warnings precede. Admin can override. |
