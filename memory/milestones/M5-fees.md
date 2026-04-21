# M5 — Fees + Suspension

**Date completed:** 2026-04-21
**Supersedes:** — (extends M3 enrolment core + M4 notifications)
**Test result:** 48 files / 249 tests green · services coverage 83.56% lines / 94.54% functions / 65.95% branches (gates 70/70/55 — all pass).

## What was built

Server-only Fees + Suspension surface. 6 new collections, 10 new services, 2
cron job handlers, 16 new route endpoints, first real PDF generator +
Cloudinary-wired storage, first signed cron infra + deterministic clock.

### Models (6 new, under [api/src/models/](../../api/src/models/))

- **`FeeStructure`** — `{programId, name, components[{kind, label, amountPaise, cadence, monthlyCount?, dueRule, weights?}], paymentTerms, deletedAt}` per TRD §4.6. Added optional `weights` (D-043).
- **`Invoice`** — `{code, enrollmentId, studentId, feeStructureId, componentKind, componentLabel, totalPaise, paidPaise, balancePaise, status}`. Unique composite `{enrollmentId, componentKind, componentLabel}` drives idempotent `generateForEnrollment`.
- **`FeeInstallment`** — `{invoiceId, studentId, label, amountPaise, paidPaise, dueDate, status, remindersSent[{template, at}]}`. Index on `{dueDate, status}` drives the hourly reminder cron.
- **`Payment`** — `{studentId, receivedAt, amountPaise, method, reference, allocations[{installmentId, amountPaise}], receivedByUserId, notes, reversed, reversedAt, reversedByUserId, creditNoteId}`.
- **`Receipt`** — `{code (RCP-YYYY-NNNNNN — Indian FY reset per D-051), paymentId (unique), studentId, pdfUrl, pdfKey, issuedAt, issuedByUserId}`.
- **`CreditNote`** — `{code, paymentId?, studentId, amountPaise, balancePaise, reason, consumed, issuedAt, issuedByUserId?}`.

### Services (under [api/src/services/](../../api/src/services/))

- **`clockService`** ([.../clockService.ts](../../api/src/services/clockService.ts)) — `nowUtc()`, `setTestNow`, `advanceTestNow`, `resetClock`. Central time source (D-047).
- **`counterService`** (extended) — `nextSeq` + format helpers: `nextInvoiceCode(year) → INV-YYYY-NNNNNN`, `nextReceiptCode`, `nextCreditNoteCode`. Width param (default 4; 6 for fee-side codes).
- **`amountInWordsService`** ([.../amountInWordsService.ts](../../api/src/services/amountInWordsService.ts)) — Indian Lakh/Crore words; `paiseToIndianWords`; `formatPaiseAsRupees` via `Intl.NumberFormat('en-IN')`.
- **`dueRuleResolver`** ([.../dueRuleResolver.ts](../../api/src/services/dueRuleResolver.ts)) — pure: each of 5 `FeeDueRule` enum values → due Date.
- **`feeStructureService`** ([.../feeStructureService.ts](../../api/src/services/feeStructureService.ts)) — CRUD + component validation; audited (`fees.structure.created/updated`).
- **`invoiceGenerationService.generateForEnrollment`** ([.../invoiceGenerationService.ts](../../api/src/services/invoiceGenerationService.ts)) — idempotent: one Invoice per component + N installments via `resolveInstallmentDueDate`. `computeInstallmentAmountsPaise` uses largest-remainder when `weights[]` set; else equal split.
- **`paymentService`** ([.../paymentService.ts](../../api/src/services/paymentService.ts)):
  - `recordPayment(input, ctx)` — auto-allocate oldest-unpaid-first (or respect explicit `allocations[]`). Atomic installment/Invoice updates. Persists Receipt PDF. Overpayment → CreditNote. Calls `reconcileForStudent` at the end so a fees-suspension clears automatically.
  - `reversePayment(id, reason, ctx)` — 24h window, debits allocations, creates CreditNote, then reconciles (may re-suspend).
  - Throws `PAYMENT_OVERAPPLIED`, `INSTALLMENT_ALREADY_PAID`, `REVERSAL_WINDOW_EXPIRED`.
- **`receiptService`** ([.../receiptService.ts](../../api/src/services/receiptService.ts)) — pdfkit → Cloudinary. `financialYearFor(date)` (D-051). PDF fields per PRD §9.6: org name/address/GSTIN, receipt code, IST date, student+IL code, allocation table with program + installment labels, total + amount-in-words, payment method + reference, "System-generated" footer.
- **`suspensionService`** ([.../suspensionService.ts](../../api/src/services/suspensionService.ts)) — `evaluateForStudent(id, now)` (pure state machine), `reconcileForStudent(id, ctx, now)` (mutates User.status + enrolment.accessState), `applyOverride(userId, {until, reason}, ctx)` / `revokeOverride`, `autoSuspendRun(now)`.
- **`feeReminderService`** ([.../feeReminderService.ts](../../api/src/services/feeReminderService.ts)) — `REMINDER_FIRE_POINTS` table (7 entries). `run(now)` scans `{status ∈ {pending,partial,overdue}, dueDate ≤ now+14d}`. Idempotency via atomic `$push` on `remindersSent[]` with the `'$ne': template` filter. `sendManualReminder(installmentId)` for the admin "send now" endpoint.
- **`studentFeesService`** ([.../studentFeesService.ts](../../api/src/services/studentFeesService.ts)) — `buildStudentFees(studentId)` → DTO envelope for the student fees page + `/v1/students/:id/fees`. `buildOutstandingFees(studentId)` → the `StudentDashboardDto.outstandingFees` aggregate (filled the M4 stub).
- **`notificationService`** (extended) — `CHANNELS_BY_TYPE` extended with 8 `fees.*` entries. WhatsApp dispatch path added; gated by `env.WHATSAPP_ENABLED` and mapped to 2 WABA templates (D-049). `Notification` model carries `whatsappSentAt` + `whatsappError`.

### Integrations

- **`CloudinaryStorageAdapter` goes live** (D-048). `upload` via `upload_stream` (authenticated delivery), `signedUrl` via `private_download_url`, `delete` via `uploader.destroy`, `signedUploadTicket` via `api_sign_request`. Stub mode (`INTEGRATIONS_MODE=stub` or `STORAGE_PROVIDER=stub`) keeps using `ConsoleStorageAdapter` with an in-process byte cache so `GET /v1/receipts/:id/download` can stream the PDF without a real provider.

### Middleware

- **`requireJobAuth`** ([api/src/middleware/requireJobAuth.ts](../../api/src/middleware/requireJobAuth.ts)) — HMAC-SHA256 over `rawBody + x-job-timestamp`, 5-min replay window, timing-safe compare. `signJobRequest(body)` helper for tests + internal clients.
- **`requireNotSuspended`** (reserved) — exists but the actual enforcement lives inside `requireAuth` (D-050) — centralised for simplicity. Fees-suspended users are whitelisted to `/students/me/fees`, `/users/me`, `/notifications/me`, `/receipts/:id/download`, `/auth/logout|refresh`, `/tickets { category: Finance }` (M6), `/payments`. Everything else → 403 `FEES_SUSPENDED`.

### Routes (all under [api/src/routes/](../../api/src/routes/))

Mounted in [routes/index.ts](../../api/src/routes/index.ts):

- `GET/POST /v1/fee-structures`, `GET/PATCH /v1/fee-structures/:id` — admin create, finance reads.
- `POST /v1/enrollments/:id/generate-fees` — admin; idempotent.
- `GET /v1/students/:id/fees` + `GET /v1/students/me/fees` alias.
- `POST /v1/payments` + `POST /v1/finance/payments` alias; `POST /v1/payments/:id/reverse`.
- `GET /v1/receipts/:id/download` — streams stub bytes or returns Cloudinary signed URL.
- `POST /v1/fees/reminders/send/:installmentId` — manual reminder trigger.
- `POST /v1/users/:id/suspension/override`, `DELETE /v1/users/:id/suspension/override` — admin grace window (D-045).
- `POST /v1/jobs/fee-reminders`, `POST /v1/jobs/autosuspend` — HMAC-protected cron endpoints.

### Cron job handlers ([api/src/jobs/](../../api/src/jobs/))

- `feeRemindersJob` — calls `run()`; audits `jobs.fee_reminders.invoked`.
- `autoSuspendJob` — calls `autoSuspendRun()`; audits `jobs.autosuspend.invoked`.

### Shared types ([packages/shared-types/src/](../../packages/shared-types/src/))

- `enums.ts` — +5 new enum arrays (`FEE_COMPONENT_KINDS`, `FEE_COMPONENT_CADENCES`, `FEE_DUE_RULES`, `INVOICE_STATUSES`, `INSTALLMENT_STATUSES`, `PAYMENT_METHODS`, `FEE_REMINDER_TEMPLATES`), 8 new `NOTIFICATION_TYPES`, `NOTIFICATION_CHANNELS` extended with `'whatsapp'`, 14 new `AUDIT_ACTIONS`.
- `dto/fees.ts` — `FeeStructureDto`, `InvoiceDto`, `FeeInstallmentDto`, `PaymentDto`, `ReceiptDto`, `CreditNoteDto`, `StudentFeesDto`, `OutstandingFeesDto`, `FeeReminderJobResult`, `AutoSuspendJobResult`, inputs.
- `dto/course.ts` — `StudentDashboardDto.outstandingFees` envelope widened to `{stub:true,totalPaise} | OutstandingFeesDto` (mirrors M4 `nextClass` pattern).

### Dashboard update

- `studentDashboardService` now calls `buildOutstandingFees` in parallel; `outstandingFees` bucket flips from `{stub:true, totalPaise:0}` to real `{stub:false, totalPaise, invoiceCount, nextDueDate, nextDueAmountPaise}`.

### Seed additions ([api/scripts/seed.ts](../../api/scripts/seed.ts))

- Finance user (`finance-seed-1@luc.local` / `Finance#12345`).
- Aviation FeeStructure with 3 components (registration ₹10k / tuition ₹60k × 3 / exam ₹4k).
- Sample student (`student-seed-1@luc.local` / `Student#12345`, IL-2026-0001) + enrolment.
- Invoice + installment generation (createdCount = 2 invoices, 4 installments).
- Sample ₹10,000 registration payment → Receipt PDF uploaded via the configured storage adapter.

### Tests (+83 new, 249/249 total)

**Unit (7 new files, 54 tests):**
- `amountInWords.test.ts` (15), `clockService.test.ts` (6), `dueRuleResolver.test.ts` (6), `counterService.test.ts` (+4 new width-aware tests), `paymentService.test.ts` (8), `feeReminderService.test.ts` (6), `suspensionService.test.ts` (9), `receiptService.test.ts` (4), `notificationService.test.ts` (+4 new fee-channel + WA-gating tests).

**Integration (6 new files, 22 tests):**
- `feeStructures.crud.test.ts` (4), `generateFees.test.ts` (3), `payments.record.test.ts` (4 — includes `payments.reverse`), `studentFees.test.ts` (4), `jobs.feeReminders.test.ts` (4), `jobs.autoSuspend.test.ts` (3 — also covers fees-suspended route gating + admin override).

**Modified:**
- `studentDashboard.test.ts` — asserts new `outstandingFees` shape (stub:false).
- `helpers/integrations.ts` — `SpyStorageAdapter` now pushes bytes into `ConsoleStorageAdapter` cache so receipt download works through the stub path.
- `helpers/factories.ts` — 7 new factories (`makeFeeStructure`, `makeInvoice`, `makeInstallment`, `makePayment`, `makeReceipt`, `makeCreditNote`, `makeOverdueStudent`).

Coverage: 83.56% lines / 94.54% functions / 65.95% branches, exceeding 70/70/55 gate.

## Files changed / added

**New (models)**: `api/src/models/{feeStructure, invoice, feeInstallment, payment, receipt, creditNote}.ts`
**New (services)**: `api/src/services/{clockService, amountInWordsService, dueRuleResolver, feeStructureService, invoiceGenerationService, paymentService, receiptService, suspensionService, feeReminderService, studentFeesService}.ts`
**New (jobs)**: `api/src/jobs/{feeRemindersJob, autoSuspendJob}.ts`
**New (middleware)**: `api/src/middleware/{requireJobAuth, requireNotSuspended}.ts`
**New (routes)**: `api/src/routes/{feeStructures, generateFees, studentFees, payments, receipts, feeReminders, suspensionOverride, jobsFees}.ts`
**New (shared-types)**: `packages/shared-types/src/dto/fees.ts`
**New (tests)**: 13 files under `api/tests/`
**New (docs)**: [docs/smoke/m5-fees.md](../../docs/smoke/m5-fees.md)

**Modified**:
- `api/src/app.ts` — `express.json({verify})` captures `rawBody` for HMAC.
- `api/src/middleware/auth.ts` — fees-suspension whitelist inline (D-050).
- `api/src/models/{index, notification}.ts` — 6 new model re-exports + Notification enum + whatsapp fields.
- `api/src/routes/index.ts` — 9 new routers mounted; `/v1/jobs/*` mounts BEFORE other routers so it bypasses the global auth stack.
- `api/src/services/{counterService, notificationService, studentDashboardService, passwordService}.ts` — extensions.
- `api/src/integrations/{index, storageAdapter}.ts` — Cloudinary live wiring + stub cache.
- `api/scripts/seed.ts` — finance + fee-structure + sample student + sample payment.
- `api/tests/helpers/{factories, integrations}.ts`.
- `packages/shared-types/src/{enums, index}.ts` + `dto/course.ts`.
- `eslint.config.js` — service-wide exceptions for `no-await-in-loop`, `no-continue`, `no-lonely-if` (sequential DB writes are required for correctness).
- `api/package.json` — added `pdfkit@^0.15.0`, `cloudinary@^2.5.1`, `@types/pdfkit@^0.13.4`.

## API surface mounted

`/v1/fee-structures`, `/v1/fee-structures/:id`, `/v1/enrollments/:id/generate-fees`, `/v1/students/:id/fees`, `/v1/students/me/fees`, `/v1/payments`, `/v1/finance/payments`, `/v1/payments/:id/reverse`, `/v1/receipts/:id/download`, `/v1/fees/reminders/send/:installmentId`, `/v1/users/:id/suspension/override` (POST/DELETE), `/v1/jobs/fee-reminders`, `/v1/jobs/autosuspend`.

All success responses `{data: ...}`; errors `{error: {code, message, details?}}`.

## Example curl flow (DoD smoke)

See [docs/smoke/m5-fees.md](../../docs/smoke/m5-fees.md). Headline:

```bash
# Seed + login as finance
MONGODB_URI=… npm run seed -w api
FT=$(curl … /v1/auth/login … | jq -r .data.accessToken)

# Record payment → auto-allocated, receipt PDF, notification
curl -sS -X POST http://localhost:4000/v1/payments \
  -H "authorization: Bearer $FT" -H 'content-type: application/json' \
  -d '{"studentId":"…","amountPaise":2000000,"method":"upi","reference":"UPI-001"}' \
  | jq .data.receipt.code
# → "RCP-2026-000002"

curl -sS -o /tmp/receipt.pdf -w '%{http_code}\n' \
  http://localhost:4000/v1/receipts/$REC/download -H "authorization: Bearer $FT"
# → 200, /tmp/receipt.pdf is a valid %PDF-1.3 document

# Cron: fee-reminders
TS=$(date +%s)
SIG=$(node -e "…HMAC…")
curl -sS -X POST http://localhost:4000/v1/jobs/fee-reminders \
  -H "x-job-signature: $SIG" -H "x-job-timestamp: $TS" -d '{}' \
  | jq '{processed, notificationsEnqueued}'
```

## Open items / known gaps for later milestones

- **Q-M5-01** (Logan) — confirm whether 40/30/30 weights are needed before M9 go-live.
- **Q-M5-02** (Logan) — separate credit-note apply endpoint? Currently auto-consumable in notes.
- **Q-M5-03** (Logan) — cap override duration at 30 days, or admin-free?
- **Q-M5-04** (Logan) — reversal window = 24h, or longer?
- **Q-M5-05** (Logan) — auto-suspend cron should skip weekends/holidays?
- **Q-M5-06 / Q-PENDING-09** (Rejin) — Cloudinary credentials for live-mode smoke before M9.

## For the next session (M6 — Tickets)

- **Reuse `requireJobAuth`** — SLA cron will be the second job. Pattern and signing helpers already tested.
- **Reuse `clockService.nowUtc()`** — ticket SLA timers are the exact same deterministic-time use case.
- **Reuse `recordAudit`** + dot-namespaced action names — add `ticket.*` and `sla.*` verbs to the `AUDIT_ACTIONS` enum.
- **Reuse `enqueueNotification`** — add a `ticket.updated` notification type; remember BRD §6.1 says WhatsApp IS used for ticket updates (`il_ticket_update` is the third pre-approved WABA template per D-007).
- **Complaint precondition** (D-008) already spec'd — `Ticket.create` must reject complaints without a prior Resolved/Closed ticket and throw `COMPLAINT_PRECONDITION_UNMET`.
- **Finance-category ticket from a fees-suspended student** — M5 `feesSuspensionAllowed` already whitelists `POST /tickets { category: 'Finance' }`. When the ticket route lands, confirm it doesn't need a second allow-list pass.
- **Counters** — `ticket_code_<YYYY>` → `TKT-ACAD-NNNNNN` (or dept-prefixed variant if Logan wants dept in the code).

## Surprises during M5

1. **D-026 vs TRD §4.1 reconciliation** — enrolment.accessState and User.status both exist; M5 mutates both atomically in `reconcileForStudent` so the login wall (User) and the course-content gate (Enrollment) agree. `applyOverride` flips to `accessState='override'` AND clears User.suspensionKind.
2. **SpyStorageAdapter bridging to ConsoleStorageAdapter** — integration tests' upload spy didn't initially cache bytes, so the download route fell through to signed-URL JSON (which the spy returns as a fake URL). Solution: `ConsoleStorageAdapter.setCached(key, bytes)` — the spy forwards bytes into the console cache using a `stub:` prefix key so the download path's byte-stream branch fires end-to-end.
3. **Rawbody capture for HMAC** — `express.json({ verify })` exposes `req.rawBody` which the cron middleware prefers over re-`JSON.stringify(req.body)`. Both paths tested; sign/verify via the same helper avoids whitespace/order differences between sender and parser.
4. **Receipt code = Indian FY (not calendar year)** — PRD §9.6 pins 1 April reset. `financialYearFor()` handles the 4-month offset relative to calendar. Invoice/CN codes still reset calendar-year per TRD default.
5. **Credit note lifecycle is loose** — Phase 1 leaves `CreditNote.consumed = false` after reversal/overpayment with no automatic consumption on next payment. Explicit apply endpoint is a Q-M5-02 open question.
6. **WhatsApp templates: two for eight notification types** — `il_fee_due` covers 5 fee events, `il_payment_received` covers 1. T-14 and T+3 skip WhatsApp per BRD §6.1 (email + in-app only).
7. **ESLint rules for services** — Sequential DB updates (installment allocation, idempotent reminder append, state-machine reconcile) made `no-await-in-loop` unavoidable. Added a service-scoped rule block in `eslint.config.js` rather than `// eslint-disable` comments everywhere.
