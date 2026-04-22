# M9 Pre-launch smoke test (24 steps)

> Source: Deployment Runbook §9.
> Operator: tick each box on a fresh browser session **and** an installed PWA on a phone.
> Only after all 24 boxes are green: flip DNS to production (per `DEPLOY.md` T-0).

| Run started | Run by | Staging URL | Result |
|---|---|---|---|
|  |  |  |  |

---

## Browser smoke (desktop, fresh incognito)

- [ ] **1.** Root URL shows the login screen (no auth redirect loop).
- [ ] **2.** Admin seed user can log in. Lands on `/admin/dashboard`.
- [ ] **3.** Admin creates a Student → invite email arrives in the operator's inbox (Brevo / Resend / SendGrid — whichever is wired).
- [ ] **4.** Student clicks magic link → sets password → lands on `/student/dashboard`.
- [ ] **5.** Admin creates Program + Course + Module with 1 video and 1 PDF (uploads to Cloudinary succeed).
- [ ] **6.** Admin publishes the course; the Student sees it on `/student/courses` and can play the video / open the PDF.
- [ ] **7.** Admin creates a Batch; enrols the Student; Student dashboard updates immediately (cache invalidates).
- [ ] **8.** Admin sets the timetable; Student sees it on `/student/timetable`.
- [ ] **9.** Admin creates a FeeStructure; system generates installments on enrolment (visible to Student on `/student/fees`).
- [ ] **10.** Finance records a payment; receipt PDF downloads from Cloudinary; Student sees "Paid" + receives `fees.paid` notification.
- [ ] **11.** Student raises an Academic ticket; Faculty receives email + in-app notification; replies; Student sees the reply on `/student/tickets/:id`.
- [ ] **12.** Student attempting to raise a Complaint ticket without a prior Resolved/Closed ticket gets the `COMPLAINT_PRECONDITION_NOT_MET` error.
- [ ] **13.** Faculty submits rubric + written + summary feedback; Student receives email + in-app notification + sees it on `/student/feedback`.
- [ ] **14.** Student attempts a quiz; passes (≥ pass-threshold); module marked complete on dashboard.
- [ ] **15.** Faculty grades final exam essays; exam marked passed; `course.completed` domain event fires (check API logs for `certificate.issue.stub` or live Certifier hit).
- [ ] **16.** Admin issues certificate (or auto-issued via the listener); certificate URL arrives in Student's email + appears on `/student/certificates`.

## Fees state-machine smoke (uses staging clock injection)

- [ ] **17.** Simulate 14-day overdue installment (bump `nowUtc` via test-only env or insert a backdated invoice) → Student dashboard shows `warn1` banner; `fees.warning.1` notification dispatched.
- [ ] **18.** Simulate 28-day overdue → Student suspended; blocked from `/student/courses` (302 → suspension page); Finance ticket route `/student/tickets/new?category=finance` still accessible.
- [ ] **19.** Admin overrides the suspension via `POST /v1/users/:id/suspension/override`; Student regains course access.

## Cron + observability smoke

- [ ] **20.** Cron `node scripts/sign-job-jwt.mjs sla-timers` (or any of the five job names) hit manually with `JOB_SECRET` + `API_ORIGIN` set → returns `{ "data": { ... } }` (HTTP 200).
- [ ] **21.** Service worker registers (Chrome DevTools → Application → Service Workers shows `activated`); app installs on a phone via "Add to Home Screen"; offline navigation to `/student/dashboard` (when previously loaded) renders from cache, otherwise shows `/offline` page.
- [ ] **22.** Sentry captures a forced server error from `GET /v1/_debug/throw` (endpoint behind `NODE_ENV !== 'production'`) — visible in Sentry project within 60s. **(Skipped if `SENTRY_DSN` empty — note in result column.)**
- [ ] **23.** Web Sentry captures a forced client error from `/student/dashboard` console: `throw new Error('boom')` — visible in Sentry within 60s. **(Skipped if `VITE_SENTRY_DSN` empty.)**
- [ ] **24.** `GET /healthz` and `GET /health` both return `{ "ok": true, "commit": "<sha>", ... }` from the public domain (proves Render's health probe target is correct).

---

## On red

If **any** box is red:

1. File the finding in `docs/smoke/findings/<date>-<step>.md` with: step #, expected, actual, repro steps, screenshots/logs.
2. Do **not** flip DNS. Treat as a blocker.
3. Fix in code or config; re-run the affected steps.
4. Only when green can the operator proceed to `DEPLOY.md` T-0.

## On green

Move to `DEPLOY.md` § T-0 (DNS flip + first-hour watch).
