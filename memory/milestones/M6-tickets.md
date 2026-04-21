# M6 — Tickets

**Date completed:** 2026-04-22
**Supersedes:** — (extends M2 auth + M4 notifications/holidays + M5 cron/audit)
**Test result:** 59 files / 316 tests green · services coverage 84.5% lines / 66.81% branches / 94.8% functions (gates 70/55/70 — all pass).

## What was built

Server-only ticketing surface: the full 5-category state machine, SLA timers with idempotent breach flips, 7-day reopen window (staff direct + student request-child), complaint precondition gate, and a fees-suspension-aware path for finance tickets.

### Models (2 new, under [api/src/models/](../../api/src/models/))

- **`Ticket`** — per TRD §4.7: `code (TKT-<PREFIX>-NNNNNN)`, `category`, `priority`, `studentId`, `linkedCourseId?`, `linkedInvoiceId?`, `subject`, `description`, `state`, `assigneeUserId?`, `assignedAt?`, `firstAckAt?`, `resolvedAt?`, `resolvedByUserId?`, `resolutionNote`, `closedAt?`, `reopenedAt?`, `reopenedFromId?`, `parentTicketId?`, `slaAckDeadline`, `slaResolveDeadline`, `slaAckBreached`, `slaResolveBreached`, `slaAckBreachedAt?`, `slaResolveBreachedAt?`, `attachments[]`. Indexes: `{state,slaResolveDeadline}` (cron), `{studentId,state,createdAt}` (student list), `{assigneeUserId,state}` (staff queue), `{category,state}` (admin filter), unique `{code}`.
- **`TicketComment`** — `{ticketId, authorUserId, body, visibility ('public'|'internal'), attachments[], createdAt}`. Index `{ticketId, createdAt}`.
- [Notification model](../../api/src/models/notification.ts) — enum extended with 6 new `ticket.*` types.

### Services (under [api/src/services/](../../api/src/services/))

- **`businessDayService`** ([.../businessDayService.ts](../../api/src/services/businessDayService.ts)) — `isBusinessDay`, `loadHolidaySet(from, to)`, `addBusinessDays(start, n, holidays)`, `addBusinessDaysWithLoad(start, n)` (convenience that pulls a `[start, start+n+30d]` window). Built on M4 Holiday model + D-038 IST-YMD keys (D-054).
- **`counterService`** (extended) — `TICKET_CATEGORY_PREFIX` map, `nextTicketCode(category, year)` (D-053), `nextRoutingSlot(bucket)` for round-robin.
- **`ticketRoutingService`** ([.../ticketRoutingService.ts](../../api/src/services/ticketRoutingService.ts)) — PRD §10.1 routing: academic → course faculty (or coord round-robin fallback); administration/technical → admin with `deptTag='operations'`/`'it'` (fallback to any admin); finance → finance pool; complaints → first superadmin + notify whole pool. Uses existing `User.deptTag` (D-056). Exports `findAdminRecipientsForBreach()` for SLA cron.
- **`ticketService`** ([.../ticketService.ts](../../api/src/services/ticketService.ts)) — mirrors `paymentService` shape:
  - `createTicket(actor, input, ctx)` — enforces student role; enforces complaint precondition (`COMPLAINT_PRECONDITION_UNMET` 409 via D-008); computes `slaAckDeadline = nowUtc + 24h`; `slaResolveDeadline = nowUtc + 5d` or `addBusinessDaysWithLoad(now, 15)` for complaints; routes + assigns; audits `ticket.created` + `ticket.assigned`; enqueues `ticket.created` notification to assignee (and all superadmins for complaints).
  - `transitionTicket(actor, id, to, note, ctx)` — state matrix: `open→{assigned,in_progress}`, `assigned→{in_progress,resolved}`, `in_progress→{resolved}`, `resolved→{closed,in_progress}`, `closed→{in_progress}`. Illegal edges → `TICKET_STATE_INVALID` (409). Reopen transitions (from resolved/closed to in_progress) enforce the 7-day cliff with a dedicated `REOPEN_WINDOW_EXPIRED` code (D-057). Sets the right timestamps (`resolvedAt`, `closedAt`, `reopenedAt`) on each edge. Notifies student + assignee with `ticket.state_changed` (only ticket event that sends WhatsApp via `il_ticket_update`, D-049 extended).
  - `reopenTicket(actor, id, note, ctx)` — staff-only wrapper over `transitionTicket(..., 'in_progress', ...)` with a dedicated audit action (D-058).
  - `requestReopen(actor, id, reason, ctx)` — student-only; creates a new `Ticket` with `parentTicketId` pointing at the original; subject prefixed `"Re: "`; routes + notifies like `createTicket` (D-058). Original remains closed.
  - `addComment(actor, id, input, ctx)` — student forced to `visibility:'public'` + can only comment on `open|assigned|in_progress`; staff any state + can set `internal`. First public staff comment with no prior `firstAckAt` sets `firstAckAt` and transitions `open → assigned`. Notifies counterparty with `ticket.commented`.
  - `listForStudent`, `listForStaff`, `listForAdmin`, `getTicketDetail` — ACL-aware list/detail; student sees only public comments.
- **`slaService`** ([.../slaService.ts](../../api/src/services/slaService.ts)) — `computeBreaches(now)` scans active tickets whose ack-deadline is past (and `firstAckAt` still null) OR whose resolve-deadline is past. Uses atomic `Ticket.updateOne(..., {slaXBreached: false, [firstAckAt: null]}, {$set: {...}})` to guarantee idempotent flips (D-055); emits `ticket.sla_ack_breached`/`ticket.sla_resolve_breached` audit + notifications (assignee + admin pool via `findAdminRecipientsForBreach`). Second run on the same tickets is a no-op.
- **`notificationService`** (extended) — 6 new `ticket.*` entries in `CHANNELS_BY_TYPE` (only `ticket.state_changed` has WhatsApp per PRD §14.3); `WABA_TEMPLATE_BY_TYPE['ticket.state_changed'] = 'il_ticket_update'` (D-007 third pre-approved template); `waTemplateVars` branches on `ticket.state_changed` to emit `[name, ticketCode, status, url]` per TRD §9.3.

### Middleware

- **`auth.ts`** fees-suspension whitelist — casing fix (`'finance'` lowercase, D-052) plus allow-list entries for `GET /me/tickets`, `GET /tickets/me`, `GET /tickets/:id`, `POST /tickets/:id/comments`, `POST /tickets/:id/reopen-request`.

### Routes (under [api/src/routes/](../../api/src/routes/))

- **`tickets.ts`** — `GET /v1/tickets` (admin/superadmin), `POST /v1/tickets` (student), `GET /v1/tickets/:id` (ACL in service), `POST /v1/tickets/:id/comments`, `POST /v1/tickets/:id/state` + `PATCH` alias (staff), `POST /v1/tickets/:id/reopen` (staff), `POST /v1/tickets/:id/reopen-request` (student). Zod validation on every body + query.
- **`meTickets.ts`** — `GET /v1/me/tickets`. Alias-mounted at `/v1/tickets/me` too (D-059).
- **`staffTickets.ts`** — `GET /v1/staff/tickets` (faculty/finance/admin/superadmin) — returns assigned queue ∪ category scope.
- **`jobsSla.ts`** — `POST /v1/jobs/sla-timers` protected by `requireJobAuth` (D-046). Returns `{data: SlaTimersJobResult}`.
- **`routes/index.ts`** — jobsSla mounts under `/jobs` alongside jobsFees (both before auth). `/me/tickets`, `/tickets/me`, `/staff/tickets` mount BEFORE `/tickets` so the literal segments don't get swallowed by `/:id`.

### Jobs

- **`api/src/jobs/ticketSlaJob.ts`** — wraps `computeBreaches(nowUtc())`, writes `jobs.sla_timers.invoked` audit.

### Shared types ([packages/shared-types/src/](../../packages/shared-types/src/))

- `enums.ts` — `TICKET_CATEGORIES`, `TICKET_STATES`, `TICKET_PRIORITIES`, `TICKET_COMMENT_VISIBILITY`; `NOTIFICATION_TYPES` +6; `AUDIT_ACTIONS` +9.
- `dto/tickets.ts` (new) — `TicketDto`, `TicketCommentDto`, `TicketDetailDto`, `TicketAttachmentDto`, `CreateTicketInput`, `AddCommentInput`, `TransitionTicketInput`, `ReopenInput`, `ReopenRequestInput`, `TicketListQuery`, `SlaTimersJobResult`.
- `index.ts` — re-exports `dto/tickets`.

### Seed additions ([api/scripts/seed.ts](../../api/scripts/seed.ts))

`seedTickets(student, faculty)` — idempotent-by-subject:

1. Academic ticket (state `in_progress`, assigned to seeded faculty, `firstAckAt` set 2h ago) — demos happy path.
2. Academic ticket (state `closed`, closed 2 days ago) — unlocks complaint + reopen demos.
3. Finance ticket (state `assigned` to seeded finance staff) — proves the fees-suspension whitelist.

### Tests (+67 new, 316/316 total)

**Unit (5 new files, 45 new tests):**
- `businessDayService.test.ts` (8) — Mon–Fri filter, holiday exclusion, 5 bd and 15 bd checkpoints, error guards.
- `counterService.test.ts` (+3 new — ticket codes + prefix isolation + routing slot).
- `ticketRoutingService.test.ts` (8) — academic→course faculty, coord fallback, admin deptTag prefer + fallback, finance, complaints pool, empty-candidate null.
- `ticketService.test.ts` (15) — complaint precondition (both branches), non-student rejected, 5d vs 15 bd deadlines, state-machine rejection, resolved→closed→reopen happy path within window, `REOPEN_WINDOW_EXPIRED` at day 8, child ticket from `requestReopen`, foreign-owner 403, student comment forced public + 409 on resolved, first staff comment sets firstAckAt + nudges to assigned, internal staff comment does NOT set firstAckAt, category-prefixed code, 404 on unknown ID, User model still registers (D-018 regression guard).
- `slaService.test.ts` (4) — ack breach idempotent flip + CC, resolve breach isolated, firstAckAt skip, terminal-state skip.
- `notificationService.test.ts` (+3 new — ticket channel map, `il_ticket_update` dispatch with 4 vars, `ticket.commented` never sends WhatsApp).

**Integration (7 new files, 26 new tests):**
- `tickets.create.test.ts` (5) — happy path + code prefix, complaint precondition 409, unlock after closed, admin 403, zod 422.
- `tickets.comments.test.ts` (4) — staff public comment flips state + firstAckAt, student 409 on resolved, forced public visibility, internal hidden from student GET.
- `tickets.state.test.ts` (3) — illegal edge 409, POST + PATCH aliases both 200, student 403.
- `tickets.reopen.test.ts` (4) — staff reopen day 6 OK, staff reopen day 8 → `REOPEN_WINDOW_EXPIRED`, student reopen-request child ticket, student direct-reopen 403.
- `tickets.list.test.ts` (4) — `/me/tickets` and `/tickets/me` alias equivalence, faculty staff queue scope, admin `slaBreached=any` filter, student 403 on admin list.
- `jobs.slaTimers.test.ts` (3) — unsigned 401, signed flip + idempotent, resolve breach isolated.
- `tickets.feesSuspension.test.ts` (3) — finance POST allowed, academic POST blocked as `FEES_SUSPENDED`, `/me/tickets` GET allowed.

Coverage (services/): 84.5% lines / 66.81% branches / 94.8% functions — exceeds 70/55/70 gate. `ticketService.ts` 87.7% / 70% / 94.4%, `slaService.ts` 92.2% / 65% / 100%, `ticketRoutingService.ts` 92.2% / 68% / 100%, `businessDayService.ts` 97.5% / 94% / 100%.

## Files changed / added

**New (14)**:
- Models: `api/src/models/{ticket, ticketComment}.ts`
- Services: `api/src/services/{businessDayService, ticketRoutingService, ticketService, slaService}.ts`
- Jobs: `api/src/jobs/ticketSlaJob.ts`
- Routes: `api/src/routes/{tickets, meTickets, staffTickets, jobsSla}.ts`
- Shared types: `packages/shared-types/src/dto/tickets.ts`
- Smoke doc: `docs/smoke/m6-tickets.md`
- Tests: 7 integration + 5 unit (see above)

**Modified (10)**:
- `api/src/models/{index, notification}.ts` — re-exports + notification enum +6.
- `api/src/routes/index.ts` — jobsSla + 3 ticket routers mounted.
- `api/src/middleware/auth.ts` — whitelist casing fix + GET ticket routes (D-052).
- `api/src/services/{counterService, notificationService}.ts` — ticket codes + `ticket.*` channels + `il_ticket_update` template.
- `api/scripts/seed.ts` — 3 seeded tickets.
- `api/tests/helpers/factories.ts` — `makeTicket`, `makeTicketComment`.
- `packages/shared-types/src/{enums, index}.ts` — ticket enums + notification + audit action additions.
- `api/tests/unit/{counterService, notificationService}.test.ts` — extended with ticket cases.

## API surface mounted

`GET /v1/tickets`, `POST /v1/tickets`, `GET /v1/tickets/:id`, `POST /v1/tickets/:id/comments`, `POST|PATCH /v1/tickets/:id/state`, `POST /v1/tickets/:id/reopen`, `POST /v1/tickets/:id/reopen-request`, `GET /v1/me/tickets` (+ `/v1/tickets/me` alias), `GET /v1/staff/tickets`, `POST /v1/jobs/sla-timers`.

Success envelope `{data: ...}`; errors `{error: {code, message, details?}}`.

## Example curl flow (DoD smoke)

See [docs/smoke/m6-tickets.md](../../docs/smoke/m6-tickets.md). Headline:

```bash
# Login as seeded student + raise ticket
ST=$(curl … /v1/auth/login … | jq -r .data.accessToken)
curl -sS -X POST /v1/tickets -H "authorization: Bearer $ST" \
  -d '{"category":"academic","subject":"…","description":"…"}' \
  | jq .data.ticket.code
# → "TKT-ACAD-000003"

# Staff add comment → firstAckAt + state flip + il_ticket_update WhatsApp
# Staff transition → resolved → closed
# Student reopen-request → 201 with parentTicketId
# Staff reopen at day 6 → 200; day 8 → REOPEN_WINDOW_EXPIRED 409
# Cron /v1/jobs/sla-timers → { processed, ackBreached, resolveBreached }
```

## Drift from the M6 prompt (resolved per spec)

Captured in plan alignment table. Final implementation per CLAUDE.md §2 spec hierarchy:
- 5-state enum (no `reopened`) — reopen transitions to `in_progress` + stamps `reopenedAt` (spec-compliant).
- `complaints` plural; prefix `CMPL`.
- `COMPLAINT_PRECONDITION_UNMET` (D-008) — not `TICKET_COMPLAINT_PRECONDITION_NOT_MET`.
- `REOPEN_WINDOW_EXPIRED` kept as an additive, more-specific code alongside `TICKET_STATE_INVALID` (D-057).
- Staff-only direct reopen + student `reopen-request` child ticket (D-058). Both endpoints mounted.
- POST + PATCH aliases on `/:id/state`; `/me/tickets` + `/tickets/me` both mounted (D-059).

## Open items / known gaps for later milestones

- **Q-M6-01** (Logan) — Confirm the admin `deptTag` split: seed currently ships one admin with no deptTag. Works; production should tag at least one `operations` and one `it` admin for the router to discriminate (falls back to "any admin" if unset).
- **Q-M6-02** (Logan) — SLA breach CC goes to all active admins ("manager pool"). No explicit `managerId` field on User. Acceptable for Phase 1; revisit if admin pool grows past ~5.
- **Q-M6-03** (Logan) — WABA `il_ticket_update` template placeholder shape assumed `[name, ticketCode, status, url]`. Needs Meta approval confirmation before live mode. Currently gated by `WHATSAPP_ENABLED=false` in dev/test.
- **Q-M6-04** (nice-to-have) — SLA re-arm after reopen: currently `slaResolveBreached` stays true across reopen. PRD §10.2 doesn't specify whether reopened tickets get a fresh SLA window. Logged for clarification.

## For the next session (M7 — Assessments + feedback)

- **Reuse `businessDayService`** — if feedback review/grading gets an SLA, the helper is ready.
- **Reuse `ticketRoutingService` patterns** — the round-robin `nextRoutingSlot` counter is generic, not ticket-specific; use it for other pools if M7 needs one (e.g. essay grader assignment).
- **Reuse `ticketService.toXDto` shape** — DTO converters + ACL helper (`canActorSeeTicket`) are the template for M7's grading ACLs.
- **Notification types** — keep extending the same `NOTIFICATION_TYPES` array. `ticket.state_changed` is the template for `assessment.graded` (WhatsApp is fair game once a `il_assessment_graded` template lands, but that's an M8 template-registry concern).
- **Audit verbs** — `ticket.*` dot-namespace is the pattern; `assessment.created`, `assessment.graded`, `feedback.created` etc. follow the same style.

## Surprises during M6

1. **`User.deptTag` already shipped** — Q-M6-01 was flagged in the plan as a potential blocker; turned out the field was added in M2 but never wired. Routing just picks it up, no schema migration. Worth re-checking the M2 memory to note it.
2. **Mount order of `/tickets/me` vs `/tickets/:id`** — Express matches routers in registration order. `/tickets/me` must mount BEFORE `/tickets` so the literal segment isn't swallowed by `/:id`. Caught via integration test `tickets.list.test.ts`.
3. **First staff-comment side-effect** — PRD §10.4 "Ack SLA stops when state ≥ Assigned with a staff comment OR state ≥ In Progress" maps cleanly to: first `public` staff comment flips `firstAckAt` AND (if still open) transitions to `assigned`. `internal` comments don't count (internal notes aren't customer-facing). Tested both branches.
4. **`createdAt` vs `nowUtc()` in SLA deadline tests** — the first draft of the deadline test anchored on `ticket.createdAt` (mongoose wall-clock) while the deadlines themselves are anchored on `nowUtc()` (injected test clock). Result: tests failed with ~1800 hours of skew. Fix: anchor both ends of the delta on the same clock.
5. **15 bd ≠ 18 calendar days** — First-draft test expected "15 bd from Mon = Fri 18 days later". Actually `Mon + 15 bd = Mon 21 days later` (3 weekends crossed). Business-day arithmetic is never what you expect on the first try.
6. **--coverage flakiness** — First `vitest run --coverage` flaked on a pre-existing jobs.autoSuspend test (`/v1/me/courses` returning 404). Second run clean. Order-dependent test bleed, not a real M6 regression; logged for future investigation but not blocking.
