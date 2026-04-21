# 01 — Business Requirements Document (BRD)

**Product:** India Learns LMS
**Client:** LUC (Dubai) — in-person Diploma Programs division, India
**Author:** Vidit Bhatnagar
**Version:** 1.0
**Date:** 21 April 2026

---

## 1. Executive summary

India Learns is a purpose-built LMS that supports LUC's in-person 300-hour Diploma Programs in India. It replaces ad-hoc spreadsheets, email, and WhatsApp threads with a single system of record for students, faculty, and finance staff. The product inherits proven patterns from LUC's existing AGI LMS but is re-scoped for a classroom-based (not self-paced) cohort model, adds fee management and student support ticketing that AGI lacks, and removes AI-heavy features that aren't required for the first two diploma programs.

The business goal is to have the system **testing internally in June 2026** and **serving real students in July 2026**, supporting an initial 126-student admission cohort across the Aviation and Retail & Fashion programs.

---

## 2. Business context

### 2.1 Why now

LUC is launching two new in-person Diploma Programs in India in July 2026. The AGI LMS (used for MBA/standalone online pathways) does not fit a classroom-based delivery model: it has no fee tracking, no ticketing, no batch-aware timetable, and no Finance role. Running the new diplomas on AGI would require heavy customisation that isn't maintainable long-term, and running them on email + spreadsheets will not scale past the second batch.

### 2.2 Who this is for

- **Primary users:** ~126 students in the first 30 days, growing to several hundred within the first year. Classroom students, mostly first jobholders or career-switchers.
- **Secondary users:** ~10 faculty/course coordinators, 2–3 administration staff, 1–2 finance staff, 1 IT admin, a small senior management team for complaint escalation.
- **Operational owner:** Rejin Rajan Sir (LUC DXB) — sponsor; Logan — day-to-day product steward.

### 2.3 Programs in scope at launch

- Aviation Diploma (300 hrs, in-person, cohort-based).
- Retail & Fashion Diploma (300 hrs, in-person, cohort-based).

Additional programs will be added via the existing Course Management workflow — no new dev work should be needed to onboard program #3.

---

## 3. Business goals (what success looks like)

| # | Goal | Success metric | Target |
|---|---|---|---|
| G1 | Launch on time | Full launch date | On or before **15 July 2026** |
| G2 | Zero-friction student onboarding | % of 126 invited students who log in within 7 days of invite | ≥ 90 % |
| G3 | Reduce fee-chase workload | Number of Finance team hours/week spent chasing overdue fees | 50 % reduction vs. current manual process within month 2 |
| G4 | Keep support responsive | Median ticket acknowledgement time | ≤ 6 hours (SLA is 24 hours) |
| G5 | Complete feedback loop | % of assignments with faculty feedback within 7 days | ≥ 80 % |
| G6 | System reliability | API uptime (Render monthly) | ≥ 99.5 % |
| G7 | Controlled cost | Total infra + SaaS spend month 1 | ≤ ₹15,000 / month (MongoDB Atlas, Render, Cloudinary, Resend, Meta WABA, Certifier) |

---

## 4. Stakeholders

| Role | Name | Responsibility |
|---|---|---|
| Sponsor | Rejin Rajan (LUC DXB) | Budget, sign-off, domain ownership |
| Product steward | Logan | Day-to-day decisions, content, test cohort |
| Product author | Vidit Bhatnagar | Specs, design, build direction |
| Delivery | Claude Code | Implementation per this doc pack |
| Finance operator | **PENDING** (Logan Q12) | UAT + daily use of Finance role |
| Content manager | **PENDING** (Logan Q12) | Uploads first batch of content |
| IT/System admin | **PENDING** | Runs the IT/Tech-support ticket queue |

---

## 5. Business requirements (what the product must do, stated as outcomes)

**BR-01 — Single source of truth for student records.** Every student enrolled in an India Learns program has one record with program, batch, enrolment validity, fee status, and access state.

**BR-02 — Admin-controlled onboarding.** Only Admin (not students) creates accounts. New students receive a magic-link email and optional WhatsApp message, set their password, and land on their dashboard.

**BR-03 — Role-segregated operations.** Five distinct roles — Admin, Superadmin (view-only), Finance, Faculty, Student — each with a tailored dashboard and permissions. Finance cannot touch course content; Faculty cannot touch fees; Superadmin can see everything but cannot change anything.

**BR-04 — Transparent fee lifecycle.** Students always see total fees, paid amount, balance, next due date, and the full installment plan. Finance records payments; the system issues a PDF receipt, updates balances, and sends a confirmation.

**BR-05 — Automated fee hygiene.** The system reminds students of upcoming and overdue fees, issues two formal warnings, and suspends access 14 calendar days after the installment due date if unpaid. Admin can override any suspension and add case notes.

**BR-06 — Structured student support.** Students raise tickets in five categories (Academic, Administration, Finance, Technical, Complaints). Each category has a defined owner team and SLA. Complaint tickets are escalation-only — they require a prior Resolved or Closed ticket.

**BR-07 — Accountable support SLAs.** Every ticket is acknowledged within 24 hours and resolved within 5 days (15 business days for Complaints). SLA breaches are tracked and visible to Admin for performance review.

**BR-08 — Personalised feedback at scale.** Faculty give students rubric-based + written + summary feedback against assignments, modules, or assessments. Students see all feedback in one dashboard; notifications go via email and in-app.

**BR-09 — Classroom timetable.** Each batch has a weekly recurring schedule visible to its students. Admin maintains the timetable; students are notified of changes.

**BR-10 — Reliable assessment and certification.** Module quizzes and final exams run end-to-end; faculty grade essay questions manually; students who pass receive a Certifier.io-issued digital certificate automatically.

**BR-11 — Compliance & data protection.** The system is designed to comply with India's **Digital Personal Data Protection Act, 2023 (DPDP Act)**. Student PII is minimised, access is audited, and data is deletable on request.

**BR-12 — Installable on mobile.** Students and staff install India Learns on their phones as a Progressive Web App, without going through the App Store (native apps deferred to Phase 2).

**BR-13 — Cost observability.** Admin can see monthly API / SaaS cost trend (AI, storage, messaging) so LUC can budget ahead of scale.

**BR-14 — Backup and continuity.** The database is backed up daily; the system can be rolled back to a known-good version within 30 minutes.

---

## 6. Scope

### 6.1 In scope (Phase 1 — for July launch)

- 5-role access with admin-created accounts and magic-link onboarding.
- Student dashboard — enrolled courses, next class, outstanding fees, new feedback, open tickets.
- Course access — modules with videos and PDFs (play + open; no watch-time / page tracking).
- Module quizzes + final exams (MCQ + essay), manual grading of essays.
- Rubric + written + summary feedback (one-way from faculty).
- Weekly recurring timetable, per batch.
- Fees module — installment plan view, manual payment recording by Finance, PDF receipts, reminders, 2-warning-then-suspend flow with admin override.
- Ticketing — 5 categories with routing, SLAs, threading, reopen-within-7-days rule, complaint escalation precondition.
- Certificates — auto-issue via Certifier.io on course completion.
- Notifications — email (primary) + WhatsApp (Fee Due, Payment Received, Ticket Updated) + in-app.
- Admin analytics — student counts, enrolment stats, quiz performance, SLA breaches, API cost tracking.
- Progressive Web App (installable).
- Hosted on Render + MongoDB Atlas ap-south-1 (Mumbai).

### 6.2 Out of scope (Phase 2 or later)

Explicitly deferred and must not be built now:

- Native iOS / Android apps (Play Store / App Store listings).
- Online payment gateway (Razorpay / Stripe / PayPal).
- AI flashcard generation.
- Voice AI assistant.
- AI-generated quiz / exam questions.
- Live class scheduling integration (Google Meet embed + .ics reminders).
- Watch-time tracking on videos or per-page tracking on PDFs.
- Public marketing landing page (direct login only for Phase 1, per Logan Q33).
- Parent / sponsor portal.
- Bulk operations (bulk enrolment, bulk fee collection).
- Refunds workflow (since no online payments in Phase 1).
- Student-to-student messaging, forums, or chat.
- Integration with the AGI LMS (separate systems).

### 6.3 Out of scope (permanently)

- Anything that attributes quotes or decisions to real public figures.
- Storing payment card data (we won't handle cards at all in Phase 1).

---

## 7. Assumptions

- LUC will register the domain and provide DNS access by **mid-May 2026** so that HTTPS + email-sender verification finishes before June testing.
- LUC will supply final SVG logo, registered office address, and GST applicability decision for receipts before the first real payment is recorded.
- LUC will designate 5–10 internal testers for the June test cohort.
- All first-batch content (videos, PDFs, rubrics) is uploaded by LUC's content manager — no content creation by the vendor.
- Students and faculty have modern smartphones and internet access.
- English is the default interface language. Localisation is a Phase 2 concern.

---

## 8. Constraints

- **Timeline:** testing June 2026, launch July 2026. Scope in §6.1 is a ceiling, not a wishlist.
- **Budget:** Phase 1 infra + SaaS envelope ≤ ₹15,000/month (G7).
- **Compliance:** DPDP Act 2023. No India-residency mandate per Logan Q1, but we choose Mumbai region for Mongo Atlas as a defensive default.
- **Stack:** MERN (Node/Express + React) on Render + MongoDB. Locked by owner decision; alternatives not considered.
- **No paid AI features in Phase 1:** AI LMS features exist in AGI but were explicitly skipped for India Learns.
- **No online payments in Phase 1:** Finance records everything manually.

---

## 9. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Domain not ready in time | Medium | High | Logan confirmed existing LUC domains available (Q5). Claude Code parameterises domain via env; swap cost is zero. |
| R2 | WABA template approval takes longer than expected | Medium | Medium | Launch email-only; toggle WhatsApp on via feature flag per template as approvals arrive. |
| R3 | GST/Receipt template not finalised before first payment | Medium | Low | Receipt template uses env-injected org name/GST/signature; placeholder receipt is legally sufficient once fee is recorded. |
| R4 | Finance operator not named by launch | Medium | High | Flag as P0 blocker to Logan; Admin role can double for Finance temporarily. |
| R5 | Volume growth outpaces single Render service | Low | Medium | Render supports vertical scaling in one click; Mongo Atlas M10+ handles 10k+ users. |
| R6 | Auto-suspension fires on a student who paid in cash | Medium | High | Reminders + 2 warnings + Admin override before suspension fires; Finance must record within 3 business days of cash receipt. |
| R7 | Faculty don't log in often enough to give feedback within 7 days | Medium | Medium | Weekly Faculty digest email listing ungiven feedback; visible on Faculty dashboard. |

---

## 10. Phasing summary

| Phase | Window | Contents |
|---|---|---|
| **Phase 1 (this doc pack)** | Build Apr–Jun 2026, test Jun, launch Jul | Everything in §6.1 |
| **Phase 2** | Aug–Sep 2026 (tentative) | Native apps (if wanted), online payments (Razorpay), advanced analytics, parent portal (if wanted), AI features on demand, deeper WhatsApp automations, bulk operations |

Phase 2 is out of scope for Claude Code until the client explicitly signs off another spec.

---

## 11. Sign-off

This BRD becomes binding once Logan (client) countersigns. Any change after sign-off requires a change-request ticket and an updated BRD + downstream docs.

- [ ] Rejin Rajan — Sponsor
- [ ] Logan — Product steward
- [x] Vidit Bhatnagar — Author (21 April 2026)
