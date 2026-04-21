# TASKS — India Learns LMS

Live task list. Update at every session start (mark new) and every session end (mark done). Source of milestone breakdown: [`claude-code-docs/CLAUDE.md` §4](claude-code-docs/CLAUDE.md).

---

## M1 — Foundations (day 1–3) — DONE 2026-04-21

- [x] Repo bootstrap — monorepo with `/api`, `/web`, `/packages/shared-types`
- [x] Memory directory + `TASKS.md` per CLAUDE.md §10
- [x] Root tooling: TS 5.4, ESLint 9 (airbnb-base via FlatCompat) + Prettier, .editorconfig, .nvmrc
- [x] `/api` skeleton: Express 4 + Mongoose 8 + pino + helmet + zod + vitest + supertest + mongodb-memory-server
- [x] `/web` skeleton: React 18 + Vite 5 + Tailwind 3 + vite-plugin-pwa + React Router 6
- [x] `/packages/shared-types` placeholder (proves workspace link graph)
- [x] `.env.example` per package (full TRD §12 list)
- [x] GitHub Actions CI: lint + typecheck + test + build on push
- [x] `GET /health` returns `{ ok: true, commit, uptimeSec, ts }`
- [x] Vite "Hello India Learns" landing page with brand palette
- [x] `npm install` + `npm run dev` work end-to-end locally
- [x] Initial commit + push to `https://github.com/viditkbhatnagar/India-Learns-LMS.git`
- [x] CI green — https://github.com/viditkbhatnagar/India-Learns-LMS/actions/runs/24719414240
- [x] Session-end memory checkpoint (`memory/milestones/M1-foundations.md` + `chore(memory): checkpoint after M1`)

## M2 — Auth + user management (day 4–7)

- [ ] Magic-link invite flow, password set, login, refresh, logout
- [ ] Audit log table + middleware
- [ ] Role model (Admin, Superadmin, Finance, Faculty, Student) + permission middleware
- [ ] Admin screens: create/edit/suspend student; create/edit faculty; finance staff

## M3 — Course + enrollment core (day 8–12)

- [ ] Program, Course, Module, Batch models
- [ ] Admin CRUD for programs/courses/modules; sandbox vs published state
- [ ] Enrollment collection (student ↔ batch ↔ course) with validity dates
- [ ] Student dashboard with enrolled courses + modules; video/PDF playback (no watch-time tracking)

## M4 — Timetable (day 13–15)

- [ ] Weekly recurring timetable per batch, admin CRUD, student read-only view
- [ ] Schedule-change notifications (email + WhatsApp + in-app)

## M5 — Fees + suspension (day 16–22)

- [ ] FeeStructure, Invoice, FeeInstallment, Payment, Receipt models
- [ ] Finance UI: record payments, generate PDF receipts, view collections
- [ ] Student fees dashboard
- [ ] Fee reminder cron (7 fire points per installment)
- [ ] Auto-suspension state machine with 2 warnings + admin override

## M6 — Tickets (day 23–28)

- [ ] Ticket model, categories, assignment, threading, reopen rules
- [ ] SLA clock (24h ack, 5d resolve, 15 business days for Complaints)
- [ ] Complaint precondition (must have prior Resolved/Closed ticket)
- [ ] Admin ticket dashboard with SLA-breach counter

## M7 — Assessments + feedback (day 29–33)

- [ ] Module quizzes (MCQ), final exams (MCQ + essay), manual grading UI
- [ ] Feedback model — rubric + written + summary
- [ ] Student feedback dashboard

## M8 — Certificates + notifications + analytics (day 34–38)

- [ ] Course completion detection + Certifier.io issue flow
- [ ] Email + WhatsApp notification engine (template registry)
- [ ] Admin analytics dashboard (counts, enrolment stats, SLA breaches, API cost tracking)

## M9 — Polish + deploy (day 39–42)

- [ ] PWA manifest + service worker + offline fallback
- [ ] Add `/healthz` + `/readyz` per TRD §14
- [ ] Render deployment per runbook
- [ ] Smoke-test checklist passing
- [ ] 3-day UX pass — copy/spacing/empty-state fixes only
