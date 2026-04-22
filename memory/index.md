# Memory index — India Learns LMS

Quick map of cross-session memory. Load these at every session start per [`/CLAUDE.md` §10](../CLAUDE.md).

| File | Purpose |
|---|---|
| [decisions.md](decisions.md) | Append-only log of architecture / spec decisions + the *why* and source citation |
| [people.md](people.md) | Stakeholders (Rejin, Logan, Vidit) + PENDING role owners |
| [glossary.md](glossary.md) | Acronyms & shorthand pulled from the doc pack |
| [open-questions.md](open-questions.md) | Anything blocked on Logan / Vidit / external input |
| [milestones/](milestones/) | One file per milestone, written at session end |
| [milestones/M1-foundations.md](milestones/M1-foundations.md) | M1 — bare scaffold (API skeleton, web skeleton, CI) |
| [milestones/M2-auth.md](milestones/M2-auth.md) | M2 — auth + user management (server-only) |
| [milestones/M3-course-enrolment.md](milestones/M3-course-enrolment.md) | M3 — Program/Course/Module/Batch/Enrollment + student dashboard + StorageAdapter |
| [milestones/M4-timetable.md](milestones/M4-timetable.md) | M4 — Timetable entries/overrides/holidays + NotificationService + dashboard nextClass |
| [milestones/M5-fees.md](milestones/M5-fees.md) | M5 — FeeStructure + Invoice + Installment + Payment + Receipt + CreditNote + reminder/autosuspend crons + CloudinaryStorageAdapter |
| [milestones/M6-tickets.md](milestones/M6-tickets.md) | M6 — Ticket + TicketComment + 5-category state machine + SLA cron + 7-day reopen window + complaint precondition |
| [milestones/M7-assessments.md](milestones/M7-assessments.md) | M7 — Quiz + QuizAttempt + Exam + ExamAttempt + Rubric + FeedbackEntry + DomainEvent + course completion + Mon 09:00 IST faculty digest cron |
| [milestones/M8-certificates-notifications-analytics.md](milestones/M8-certificates-notifications-analytics.md) | M8 — Certificate + CertificateAdapter + NotificationPrefs + ApiCostLedger + AnalyticsService + retry sweep cron + M2–M8 web UI port |
| [milestones/M9-polish-deploy.md](milestones/M9-polish-deploy.md) | M9 — Email adapters live (Resend/SendGrid/Brevo) + Sentry + /healthz + render.yaml + sign-job script + DEPLOY.md + 30+ UI screens + PWA + Playwright + Lighthouse |

## Conventions

- Spec wins over memory. If memory and `claude-code-docs/` disagree, fix the memory and flag the drift in the session report.
- `decisions.md` is **append-only** — never rewrite history; add a new dated entry that supersedes.
- Every entry cites the spec section it came from (`BRD §4`, `TRD §12`, etc.) so future sessions can re-verify.
