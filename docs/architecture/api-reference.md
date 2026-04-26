# API Reference

A hand-written catalog of the public API surface, grouped by resource. The authoritative source is the route files in [`api/src/routes/`](../../api/src/routes/) — when in doubt, read the code.

> **Status:** v0.1, maintained by hand. Generating an OpenAPI spec from the inline `zod` schemas via `@asteasolutions/zod-to-openapi` is a planned follow-up (touches code, deferred from the current docs PRs).

## Conventions

- **Base URL** — `https://il-app.onrender.com/v1` (staging), `{{WEBSITE_URL}}/v1` (production).
- **Authentication** — `Authorization: Bearer <accessToken>` for every authenticated route. The refresh-token cookie (`__Host-il_rt`) is required for `/auth/refresh` and `/auth/logout` only.
- **Error envelope** — `{ "error": { "code": "<MACHINE_CODE>", "message": "<human>", "details"?: {...} } }` with the appropriate HTTP status.
- **Time** — request/response timestamps in ISO-8601 UTC.
- **Money** — integer paise; `{component}Paise: 250000` means ₹2,500.00.

## 0. Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | Returns `{ ok, commit, uptimeSec, ts }` |
| GET | `/healthz` | none | Same body — Render's default health probe path |

## 1. Auth (`api/src/routes/auth.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/auth/login` | none | Email + password → access token + refresh cookie. Rate limited (5/15m + lockout). |
| POST | `/v1/auth/refresh` | refresh cookie | Rotates refresh token, returns new access token. Family revoked on reuse. |
| POST | `/v1/auth/logout` | refresh cookie | Revokes the presented refresh token. |
| POST | `/v1/auth/accept-invite` | none | Consumes magic link, sets password, signs user in. |
| POST | `/v1/auth/forgot-password` | none | Issues reset token (rate-limited per IP). Always returns 200 to prevent enumeration. |
| POST | `/v1/auth/reset-password` | none | Consumes reset token + sets new password. |
| POST | `/v1/auth/change-password` | bearer | Logged-in change. Verifies current, enforces non-reuse, revokes all sessions. |

## 2. Users (`api/src/routes/users.ts`, `suspensionOverride.ts`)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/v1/users/me` | any | Self-profile. |
| PATCH | `/v1/users/me` | any | Self-edit (name/phone/address). |
| GET | `/v1/users` | admin/superadmin | List with filters (role, status, programme, batch, search). |
| POST | `/v1/users` | admin/superadmin | Invite new user. |
| GET | `/v1/users/:id` | admin/superadmin/finance | Detail. |
| PATCH | `/v1/users/:id` | admin/superadmin | Edit. |
| POST | `/v1/users/:id/resend-invite` | admin/superadmin | Reset 7-day invite token. |
| POST | `/v1/users/:id/suspend` | admin/superadmin | Manual suspension with reason. |
| POST | `/v1/users/:id/unsuspend` | admin/superadmin | Lift manual suspension. |
| DELETE | `/v1/users/:id` | superadmin | Soft-delete. |
| POST | `/v1/users/:id/suspension-override` | admin/superadmin | Override fees suspension with end-date. |

## 3. Programmes / courses / modules / batches

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET\|POST\|PATCH\|DELETE` | `/v1/programs[, /:id]` | admin/superadmin | Programme CRUD. |
| `GET\|POST\|PATCH\|DELETE` | `/v1/courses[, /:id]` | admin/superadmin (write); any (read scoped) | Course CRUD; sandbox/publish state. |
| GET | `/v1/courses` | faculty (mine=true) | Faculty's assigned courses. |
| GET | `/v1/courses/:id/announcements` | enrolled / faculty / admin | Announcements feed. |
| POST | `/v1/courses/:id/announcements` | faculty / admin | Post. |
| `GET\|POST\|PATCH` | `/v1/courses/:id/sessions[, /:sessionId]` | faculty / admin | Sessions per course. |
| GET | `/v1/sessions/:id` | faculty / admin | Session detail. |
| PATCH | `/v1/sessions/:id` | faculty / admin | Update + complete. |
| `GET\|POST` | `/v1/courses/:id/assignments[, /:aid]` | faculty / admin / enrolled student | Assignment CRUD. |
| `GET\|POST` | `/v1/assignments[, /:id]` | faculty / admin | Cross-course access. |
| `GET\|POST\|PATCH` | `/v1/assignment-submissions/:id[/draft\|/publish]` | faculty / admin | Two-step grading. |
| GET | `/v1/courses/:id/gradebook` | faculty / admin | Matrix. |
| `GET\|POST\|PATCH` | `/v1/modules[, /:id]` | admin/superadmin | Module CRUD. |
| `GET\|POST\|PATCH\|DELETE` | `/v1/batches[, /:id]` | admin/superadmin | Batch CRUD. |
| `GET\|POST\|PATCH` | `/v1/batches/:id/timetable[, /:eid]` | admin/superadmin | Per-batch timetable. |

## 4. Enrolments (`enrollments.ts`, `generateFees.ts`)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET\|POST\|PATCH` | `/v1/enrollments[, /:id]` | admin/superadmin | Enrolment CRUD. |
| POST | `/v1/enrollments/:id/generate-fees` | admin/finance | Create invoice + instalments. |
| POST | `/v1/enrollments/:id/issue-certificate` | admin/superadmin | Admin retry of certificate. |

## 5. Student-scoped (`me*` routers)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/v1/me/courses` | student | My enrolled courses. |
| GET | `/v1/me/timetable` | student | Resolved weekly view. |
| GET | `/v1/students/me/dashboard` | student | KPIs + upcoming. |
| GET | `/v1/students/me/fees` | student | Outstanding + history. |
| GET | `/v1/students/:id/fees` | admin/finance | Other student's fees (admin/finance). |
| GET | `/v1/me/notifications` | any | List + unread counter. |
| `GET\|PATCH` | `/v1/me/notification-prefs` | any | Per-channel toggles. |
| GET | `/v1/me/certificates` | student | Issued credentials. |
| GET | `/v1/me/feedback` | student | Feedback I've submitted / been asked to submit. |

## 6. Tickets (`tickets.ts`, `meTickets.ts`, `staffTickets.ts`)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/v1/me/tickets` | any | My tickets (alias `/v1/tickets/me`). |
| POST | `/v1/me/tickets` | any | Create. |
| GET | `/v1/tickets/:id` | requester / assignee / admin | Detail + thread. |
| POST | `/v1/tickets/:id/comments` | participant / staff | Add comment. |
| POST | `/v1/tickets/:id/transition` | staff | State change. |
| POST | `/v1/tickets/:id/assign` | admin | Assign to staff. |
| POST | `/v1/tickets/:id/reopen-request` | requester | Within 15-day window. |
| GET | `/v1/staff/tickets` | staff | Assigned to me. |
| GET | `/v1/tickets/sla-breaches` | admin | Aged + overdue. |

## 7. Fees and payments (`payments.ts`, `receipts.ts`, `feeStructures.ts`, `feeReminders.ts`)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET\|POST\|PATCH` | `/v1/fee-structures[, /:id]` | admin | Programme fee components. |
| GET | `/v1/payments` | finance/admin | List with filters. |
| POST | `/v1/payments` | finance/admin | Record payment. |
| GET | `/v1/payments/:id` | finance/admin | Detail. |
| POST | `/v1/payments/:id/reverse` | finance/admin | Reversal with reason. |
| GET | `/v1/finance/payments` | finance/admin | Same as `/payments` (alias). |
| GET | `/v1/receipts/:id/download` | finance/admin/owner | Signed Cloudinary URL. |
| POST | `/v1/fees/reminders/send` | admin | Manual reminder fan-out. |

## 8. Quizzes / exams / rubrics / feedback / certificates

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET\|POST\|PATCH` | `/v1/quizzes[, /:id]` | faculty/admin | Quiz CRUD. |
| POST | `/v1/quiz-attempts` | student | Start attempt. |
| POST | `/v1/quiz-attempts/:id/submit` | student | Submit answers; auto-scored. |
| `GET\|POST\|PATCH` | `/v1/exams[, /:id]` | faculty/admin | Exam CRUD. |
| `POST\|PATCH` | `/v1/exam-attempts[, /:id/submit\|/grade]` | student/faculty | Submit + grade. |
| `GET\|POST\|PATCH` | `/v1/rubrics[, /:id]` | faculty/admin | Rubric CRUD. |
| `GET\|POST\|PATCH` | `/v1/feedback[, /:id]` | faculty/admin/student | Feedback survey + responses. |
| GET | `/v1/me/certificates` | student | My credentials. |

## 9. Notifications and announcements

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/v1/notifications/me` | any | List. |
| POST | `/v1/notifications/me/:id/read` | any | Mark read. |
| (handled inline) | — | admin / faculty | Announcements live under courses. |

## 10. Holidays / overrides

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET\|POST\|PATCH\|DELETE` | `/v1/holidays[, /:id]` | admin | Holiday calendar. |
| `GET\|POST\|PATCH\|DELETE` | `/v1/timetable/overrides[, /:id]` | admin | Per-day overrides. |

## 11. Audit logs

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/v1/audit-logs` | admin/superadmin | Filter by actor/target/action/date. |

## 12. Curriculum import

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/v1/curriculum-import/preview` | superadmin | Dry-run. |
| POST | `/v1/curriculum-import/run` | superadmin | Apply. |
| GET | `/v1/curriculum-import/health` | superadmin | Recovery status. |

## 13. Storage

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/v1/storage/sign-upload` | any (role-scoped per folder) | Mint a signed Cloudinary upload ticket; TTL 5 min. |
| POST | `/v1/storage/delete` | admin (or owner per resource) | Delete by key. |

## 14. Cron-only endpoints

All under `/v1/jobs/*`. Auth: `requireJobAuth` (HMAC over `rawBody+timestamp` + 5-min replay window). Public network access blocked unless signed.

| Path | Cron | Notes |
|---|---|---|
| `/v1/jobs/fee-reminders` | `il-cron-fee-reminders` | Daily 03:00 UTC. |
| `/v1/jobs/autosuspend` | `il-cron-autosuspend` | Daily 22:00 UTC. |
| `/v1/jobs/sla-timers` | `il-cron-sla-timers` | Every 15 min. |
| `/v1/jobs/digest-faculty-weekly` | `il-cron-faculty-digest` | Mon 03:30 UTC. |
| `/v1/jobs/notifications-retry` | `il-cron-notifications-retry` | Every 15 min. |

## 15. Error codes (selected)

The full enum lives in `india-learns-shared-types`. Common ones:

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing / invalid / expired token |
| `FORBIDDEN` | 403 | Wrong role |
| `SUSPENDED_ACCESS` | 403 | Manual suspension |
| `FEES_SUSPENDED` | 403 | Fees suspension hit a non-whitelisted route |
| `VALIDATION_FAILED` | 422 | zod schema rejected the body |
| `TOKEN_EXPIRED` | 410 | Invite or reset link expired |
| `RATE_LIMITED` | 429 | Login or password-reset rate limit |
| `NOT_FOUND` | 404 | Resource absent |

## 16. Roadmap

- Generate machine-readable OpenAPI from inline zod schemas using `@asteasolutions/zod-to-openapi`.
- Add Postman / Insomnia exports.
- Add request/response examples to each endpoint.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release that changes routes._
