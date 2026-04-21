# CLAUDE.md — India Learns LMS

> **This file is the entry point for Claude Code.**
> Read this file first. It tells you what to build, in what order, and where every detail lives. All subsequent decisions must be consistent with the documents referenced below.

---

## 1. What you are building

**Product:** India Learns — a Learning Management System for LUC's in-person 300-hour Diploma Programs (Aviation, Retail & Fashion).

**Scale:** Max 30 students per class. Projected 126 admissions in the first 30 days. Design the system so it comfortably serves 1,000 concurrent users without re-architecture.

**Deployable on:** Render (web services + cron) + MongoDB Atlas. No Docker required; use native Render Node.js runtime.

**Timeline anchor:** Phase 1 (everything in this doc pack) must be ready for **June internal test**, **July full launch**. All scope in this pack is Phase 1.

---

## 2. Document pack — read in this order

| # | File | What it tells you |
|---|---|---|
| 1 | `CLAUDE.md` (this file) | How to read the pack, conventions, build order, DoD |
| 2 | `01_BRD.md` | Why we're building it, stakeholders, success metrics, scope in/out |
| 3 | `02_PRD.md` | Every feature, every user story, every acceptance criterion, per-role permissions matrix, all state machines |
| 4 | `03_TRD.md` | Architecture, full Mongoose schemas, every REST endpoint, integrations, env vars, security |
| 5 | `04_UI_UX_Spec.md` | Brand system, screen inventory mapped to existing JSX mockups, components, accessibility, PWA |
| 6 | `05_Deployment_Runbook.md` | Render + MongoDB Atlas setup, DNS, background jobs, monitoring, rollback |

**Source-of-truth hierarchy when docs disagree:** TRD > PRD > BRD > UI/UX Spec. If you find a contradiction, stop and flag it — do not silently pick one.

**Existing design assets you must consume (not rewrite):**
- `../webapp/screens-staff.jsx`, `screens-student.jsx`, `screens-student2.jsx`, `screens-extras.jsx`, `components.jsx`, `styles.css`, `responsive.css` — React components for the web UI.
- `../mobile/screens-mobile.jsx`, `components.jsx`, `ios-frame.jsx`, `styles.css` — mobile PWA components.
- Port these into the `web/` app (see TRD §3). The look-and-feel in those files is **approved** — do not redesign.

---

## 3. Tech stack (locked)

- **Backend:** Node.js 20 LTS, Express 4, Mongoose 8, MongoDB 7 (Atlas).
- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3 + React Router 6. PWA via `vite-plugin-pwa`.
- **Auth:** Custom — JWT access + refresh tokens, Argon2id password hashing, magic-link invite flow, rate-limited login. See TRD §7.
- **File storage:** Cloudinary (course videos, PDFs, receipts). Provider is pluggable behind `StorageService` interface.
- **Email:** Resend (primary) with SendGrid fallback, behind `EmailService` interface.
- **WhatsApp:** Meta WhatsApp Business API (cloud), behind `WhatsAppService` interface. Templates pre-approved by LUC ops.
- **Certificates:** Certifier.io REST API, behind `CertificateService` interface.
- **Jobs/cron:** Render cron jobs hitting internal signed endpoints (see TRD §11) — no separate queue infra for Phase 1.
- **Deployment:** Render — two services (API + static web) + one cron job, MongoDB Atlas cluster in AWS ap-south-1 (Mumbai) for DPDP Act 2023 alignment.

Do not introduce additional libraries without reading TRD §3.4 "Allowed dependencies". If you need one not listed, add it to a file called `DEPENDENCY_REQUEST.md` in the repo root and continue with a built-in alternative for now.

---

## 4. Build order

Follow this order strictly. Each milestone is demoable and testable on its own.

**M1 — Foundations (day 1–3)**
1. Repo bootstrap: monorepo with `/api` and `/web` workspaces, shared `/packages/shared-types` for DTO types.
2. CI: GitHub Actions running lint + test on every PR.
3. MongoDB connection, health endpoint `GET /api/health`, logging (pino), request id middleware.
4. User model + seed script that creates one super-admin.

**M2 — Auth + user management (day 4–7)**
5. Magic-link invite flow, password set, login, refresh, logout, audit log table.
6. Role model (Admin, Superadmin, Finance, Faculty, Student) + permission middleware.
7. Admin screens: create/edit/suspend student; create/edit faculty; finance staff.

**M3 — Course + enrollment core (day 8–12)**
8. Program, Course, Module, Batch models.
9. Admin CRUD for programs/courses/modules. Sandbox vs published state.
10. Enrollment collection (student ↔ batch ↔ course) with validity dates.
11. Student dashboard showing enrolled courses + modules. Video/PDF playback **without** watch-time or page tracking (confirmed by Logan Q3).

**M4 — Timetable (day 13–15)**
12. Weekly recurring timetable per batch, admin CRUD, student read-only view.
13. Schedule-change notifications (email + WhatsApp + in-app).

**M5 — Fees + suspension (day 16–22)** — heaviest module
14. FeeStructure, Invoice, FeeInstallment, Payment, Receipt models.
15. Finance UI to record payments, generate PDF receipts, view collections.
16. Student fees dashboard.
17. Fee reminder cron — 7 fire points per installment (see PRD §9.4).
18. Auto-suspension state machine with 2 warnings + admin override.

**M6 — Tickets (day 23–28)**
19. Ticket model, categories, assignment, threading, reopen rules.
20. SLA clock (24h acknowledge, 5d resolve, 15 business days for Complaints).
21. Complaint-ticket precondition (must have prior Resolved/Closed ticket).
22. Admin ticket dashboard with SLA-breach counter.

**M7 — Assessments + feedback (day 29–33)**
23. Module quizzes (MCQ), final exams (MCQ + essay), manual grading UI.
24. Feedback model — rubric + written + summary, per-assignment/module/assessment.
25. Student feedback dashboard (read-only + email/in-app alert).

**M8 — Certificates + notifications + analytics (day 34–38)**
26. Course completion detection, Certifier.io issue flow.
27. Email + WhatsApp notification engine (template registry).
28. Admin analytics dashboard (counts, enrollment stats, SLA breaches, API cost tracking).

**M9 — Polish + deploy (day 39–42)**
29. PWA manifest, service worker, offline fallback for viewed content.
30. Render deployment per runbook.
31. Smoke-test checklist (see Deployment Runbook §9).
32. 3-day UX pass — no new features, only copy/spacing/empty-state fixes.

---

## 5. Conventions

**Repo layout** (monorepo, npm workspaces):
```
india-learns/
├─ api/                   # Express backend
│  ├─ src/
│  │  ├─ models/          # Mongoose models, one file per collection
│  │  ├─ routes/          # Express routers, one file per resource
│  │  ├─ controllers/     # Thin, call services
│  │  ├─ services/        # Business logic, pure where possible
│  │  ├─ middleware/      # auth, role-gate, rate-limit, errorHandler
│  │  ├─ integrations/    # certifier, whatsapp, email, storage
│  │  ├─ jobs/            # cron endpoints
│  │  └─ utils/
│  ├─ tests/
│  └─ package.json
├─ web/                   # React frontend
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ lib/api.ts       # thin axios wrapper
│  │  ├─ routes.tsx
│  │  └─ styles/
│  ├─ public/
│  └─ package.json
├─ packages/
│  └─ shared-types/       # DTO types shared across api + web
├─ docs/                  # Copy of this doc pack at repo root for reference
└─ package.json           # npm workspaces root
```

**Code style:** TypeScript everywhere. ESLint (airbnb-base + @typescript-eslint) + Prettier. No CommonJS; use ESM with `type: "module"`. One Mongoose model per file. Controllers are thin — business logic goes in `services/`.

**Testing:** Vitest (shared config). Unit tests for every service function. Integration tests for every route group (auth, users, courses, enrollments, fees, tickets, feedback, timetable). Minimum 70% line coverage on `services/`. No snapshot tests of HTML.

**Env vars:** Every secret belongs in env vars, never in code. Validate on boot with `zod`. The full list is in TRD §12.

**Dates & times:** Store everything as UTC in Mongo. Display in `Asia/Kolkata` on the UI. Use `date-fns-tz`, not Moment.

**Money:** Store as integer paise (₹1 = 100 paise) in a field named `{field}Paise`. Format on the UI with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

**IDs:** Mongo `_id` (ObjectId). Expose to clients as `id` string. Add a human-readable `code` field on Student (`IL-2026-0001`), Invoice (`INV-2026-000012`), Ticket (`TKT-ACAD-000045`), Receipt (`RCP-2026-000001`).

**Error envelope:** All errors return `{ error: { code: string, message: string, details?: object } }` with correct HTTP status. Codes listed in TRD §8.

**Audit log:** Every write by Admin, Finance, or Faculty is logged to `audit_logs` collection — actor, action, target, before, after, at. Finance actions (record payment, issue receipt, override suspension) are non-negotiable.

---

## 6. Definition of Done (per feature)

A feature is done only when **all** of the following are true:

- [ ] Backend: route + controller + service + Mongoose model implemented.
- [ ] Backend: unit tests for service, integration test for route (happy + one failure case).
- [ ] Frontend: page or component implemented, wired to API, loading + empty + error states.
- [ ] Permission gated per role matrix (PRD §3.1).
- [ ] Works on mobile viewport (375 × 812) and desktop (1440 wide).
- [ ] Copy reviewed — no lorem ipsum, no placeholder strings.
- [ ] Audit log entry written for any write by staff roles.
- [ ] No console errors, no unresolved TypeScript errors.
- [ ] Manual smoke test walkthrough committed as `docs/smoke/<feature>.md`.

---

## 7. What Claude Code must NOT do

- Do not invent features not in this pack. If a screen or behaviour isn't specified, ask in a `QUESTIONS.md` file and stop on that feature until answered.
- Do not wire real API keys. Use stub adapters behind each integration interface. Real keys are injected at deploy time (see Deployment Runbook §4).
- Do not add a payment gateway, AI flashcards, voice AI, AI quiz generation, or live-class scheduling — these are explicitly out of Phase 1 (BRD §6).
- Do not roll your own crypto. Use Argon2id via `argon2` and JWTs via `jose`.
- Do not commit secrets, certificates, or `.env` files. `.env.example` only.
- Do not ship without the Deployment Runbook smoke-test checklist passing.

---

## 8. Pending items (do not block on these)

These need external input (tracked in Vidit's Q11/Q12 to Logan). Implement stubs and feature-flag them:

- Official India Learns logo SVG → use placeholder `brand/logo-placeholder.svg` generated from brand colors.
- Registered office address + GST number for receipts → use `RECEIPT_ORG_NAME`, `RECEIPT_ORG_ADDRESS`, `RECEIPT_ORG_GSTIN` env vars.
- Domain → build assuming `app.indialearns.com`; Render config parameterises this.
- Meta WABA templates → ship `WhatsAppService.sendTemplate()` as a no-op logger in dev mode; toggle on via `WHATSAPP_ENABLED=true`.
- Certifier.io API key → stub issues a fake certificate URL in dev.

---

## 9. Who to credit in docs

- **Product owner (client side):** Rejin Rajan (LUC DXB), Logan.
- **Product author (vendor side):** Vidit Bhatnagar.
- Footer copyright: "© 2026 LUC / India Learns. All rights reserved."

---

## 10. Cross-session memory — MANDATORY

Because this build spans many sessions (one per milestone per `PROMPTS.md`), Claude Code must treat memory as a first-class artifact. Every session starts by reading memory, and every session ends by writing memory. Without this, each new session starts blind and re-asks questions already answered.

**Skills to use:**

- `productivity:memory-management` — the two-tier memory system (working memory + knowledge base). Invoke this at the start of every session.
- `productivity:task-management` — the `TASKS.md` shared file for tracking what's done / in flight / blocked across sessions.
- `productivity:update` — run this when you pick up a new session to refresh memory against the current repo state.

**Folder layout Claude Code must maintain at the repo root:**

```
/CLAUDE.md              ← this file (working memory + operating manual, lives at repo root)
/PROMPTS.md             ← the milestone prompt script (lives at repo root)
/TASKS.md               ← live task list (create in M1, update every session)
/memory/
  ├─ index.md           ← table of contents for memory entries
  ├─ decisions.md       ← append-only log of architecture / spec decisions + rationale
  ├─ people.md          ← Logan, Rejin, Vidit — contact context, preferences, open questions
  ├─ glossary.md        ← acronyms + shorthand (LUC, AGI LMS, WABA, DPDP, etc.)
  ├─ milestones/
  │    ├─ M1-foundations.md
  │    ├─ M2-auth.md
  │    └─ ...           ← one per milestone, written at session end
  └─ open-questions.md  ← anything blocking that needs Logan/Vidit
/claude-code-docs/      ← the full spec pack (this folder; treat as read-only source of truth)
```

**Session start protocol (every session, no exceptions):**

1. Read `/CLAUDE.md` (this file) in full.
2. Read `/memory/index.md` → follow links to load relevant entries.
3. Read `/TASKS.md` — know what's open.
4. Read `/memory/milestones/M{N-1}*.md` for the previous milestone to inherit context.
5. Read the relevant spec sections per the milestone prompt from `/PROMPTS.md`.
6. Only then start work.

**Session end protocol (every session, before reporting back):**

1. Append new decisions to `/memory/decisions.md` (with date + rationale + where in the spec it came from).
2. Write or update `/memory/milestones/M{N}-{name}.md` with:
   - What was built
   - What tests pass
   - What files changed
   - Any open questions or follow-ups
   - Anything the next session needs to know
3. Update `/TASKS.md` — mark done items done, add new items.
4. Update `/memory/index.md` if new entries were added.
5. Update `/memory/open-questions.md` if anything is blocked on external input.
6. Commit memory updates in the same commit as the milestone code: `chore(memory): checkpoint after M{N}`.

**When memory contradicts the spec:** the spec wins. Memory is a cache of decisions + context, not a replacement for the doc pack. If you find a drift, fix the memory entry and flag it in the session report.

**First-time bootstrap:** during M1 (Foundations), Claude Code must create the `/memory/` folder, seed `/memory/glossary.md` with terms lifted from the doc pack (LUC, AGI LMS, WABA, DPDP Act, Certifier.io, PWA, etc.), and seed `/memory/people.md` from `01_BRD.md §4`.

---

## 11. Available Claude Code skills (use them)

Claude Code should proactively use these skills where they fit — don't reinvent the wheel:

- **`productivity:memory-management`, `productivity:task-management`, `productivity:update`, `productivity:start`** — see §10 above. Mandatory.
- **`doc-coauthoring`** — when updating any file in `claude-code-docs/` due to a client amendment, use this skill so the update is structured and reviewed.
- **`docx`, `pdf`, `xlsx`** — for generating receipts, certificates, or exports. Receipts are rendered server-side with `pdfkit` (per TRD §9); these skills are for ad-hoc client-requested reports.
- **`design:accessibility-review`** — run during M9 polish; target WCAG 2.1 AA per UI/UX Spec §10.
- **`design:design-critique`, `design:design-handoff`, `design:ux-copy`** — for any UI-level questions during M3, M4, M5, M9.
- **`operations:runbook`** — when extending `05_Deployment_Runbook.md` with new operational procedures.
- **`operations:risk-assessment`, `operations:change-request`** — for any post-launch change.
- **`operations:compliance-tracking`** — for DPDP Act 2023 compliance artefacts (BRD BR-11).
- **`product-management:write-spec`** — when Logan asks for a new feature; spec it out before building.
- **`product-management:stakeholder-update`** — for the weekly status email to Rejin/Logan.
- **`security-review`** — run before every merge to `main`. Non-negotiable on auth, fees, and ticket modules.
- **`review`** — run on every PR before requesting human review.
- **`mcp-builder`** — if a future integration needs a custom MCP adapter (not in Phase 1 scope).

**Skill invocation convention:** when a milestone prompt says "use the X skill", invoke it via the Skill tool and follow its SKILL.md instructions in full. Skill output is part of the deliverable.

---

_Last updated: 21 April 2026. This doc is the contract — if the client amends requirements mid-build, update this file and the affected downstream doc in the same PR._
