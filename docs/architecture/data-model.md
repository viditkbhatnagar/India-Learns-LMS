# Data Model

Every persistent collection in India Learns, grouped by purpose, with the fields that matter and the indices that exist. The authoritative source is [`api/src/models/`](../../api/src/models/) — this doc is the navigable summary.

> **Conventions throughout:**
>
> - All collections include `createdAt` and `updatedAt` (Mongoose timestamps), unless noted.
> - Soft-delete uses `deletedAt: Date | null` rather than removal.
> - Money fields are integer **paise** (₹1 = 100 paise) in field names ending `Paise` — see [ADR 0006](adrs/0006-money-as-integer-paise.md).
> - Times stored UTC, displayed IST.
> - IDs exposed to clients as `id` (string), not `_id`.

## 1. Identity

### `User` ([`models/user.ts`](../../api/src/models/user.ts))

The principal of every authenticated request.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `role` | enum | `admin\|superadmin\|finance\|faculty\|student` (indexed) |
| `code` | string \| null | Human-readable code for student/faculty (`IL-YYYY-NNNN`); unique partial index |
| `name`, `email`, `phoneE164`, `address` | string | `email` unique + indexed, lowercase |
| `passwordHash`, `passwordHistoryHashes`, `passwordUpdatedAt` | string / string[] / Date | Stripped from JSON |
| `status` | enum | `pending\|active\|suspended\|revoked` (indexed) |
| `suspensionKind`, `suspensionReason`, `suspensionOverrideUntil`, `suspensionOverrideBy` | enum / strings / Date / ObjectId | Lifecycle of fees vs manual suspension |
| `lastLoginAt`, `loginFailCount`, `lockedUntil` | Date / number / Date | Auth telemetry; lock fields stripped from JSON |
| `programId`, `batchId` | ObjectId | Student linkage; `batchId` indexed |
| `enrolmentValidFrom`, `enrolmentValidTo` | Date | Access-control window |
| `deptTag`, `isCourseCoordinator` | enum / boolean | Faculty/admin operational tags |
| `sessionCap` | number | Per-user override of `SESSION_CAP` |
| `deletedAt` | Date \| null | Soft-delete marker |

**Indexes**: `email` unique, `role`+`batchId`+`status`, `code` unique-partial.

### `RefreshToken` ([`models/refreshToken.ts`](../../api/src/models/refreshToken.ts))

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `familyId` | ObjectId | Family for reuse-revocation |
| `tokenHash` | string | SHA-256 of plaintext |
| `deviceId`, `ua`, `ip` | string | Forensic |
| `expiresAt`, `revokedAt`, `rotatedFromId`, `rotatedToId` | dates / IDs | Lifecycle |

### `InviteToken` ([`models/inviteToken.ts`](../../api/src/models/inviteToken.ts))

Unified token for invite + password-reset flows; SHA-256-hashed; TTL-indexed.

### `Session` ([`models/session.ts`](../../api/src/models/session.ts))

Tracks live sessions per user; capped at `SESSION_CAP` by eviction.

## 2. Academic structure

### `Program` — Programme catalogue (Aviation, Retail & Fashion, etc.).

### `Course` — Belongs to a Program. Has `state: sandbox|published`.

### `Module` — Belongs to a Course. Has ordered child Sessions.

### `Material` — Slide deck / PDF / link. Owned by Module or Session.

### `Session` ([`models/session.ts`](../../api/src/models/session.ts)) — A scheduled class instance. Links to Module, optional Faculty, scheduled start/end (UTC), state (`scheduled|completed`), private notes (faculty-only), linked MLOs (curriculum).

### `Batch` — A cohort within a Program.

### `Announcement` — Course-scoped announcements.

### `Holiday` — Cancels classes for that date across all batches.

### `TimetableEntry` — Recurring weekday slot for a Batch + Course.

### `TimetableOverride` — Per-day cancel/reschedule.

## 3. Enrolment and delivery

### `Enrollment` — student × batch × course validity window. Drives access control.

### `AttendanceRecord` — per Session × Student. Status `present|absent|late`.

## 4. Assessments

### `Quiz`, `QuizAttempt` — MCQ, auto-scored.

### `Exam`, `ExamAttempt` — MCQ + essay; essay graded manually.

### `Assignment`, `AssignmentSubmission` — submitted work, draft/publish workflow.

### `Rubric` — scoring scales for assignments and exams.

### `FeedbackEntry` — student feedback responses (numeric + text), per target type (course/instructor/assessment/session).

## 5. Finance

### `FeeStructure` — components per programme: tuition, examination, material, miscellaneous; integer paise.

### `FeeInstallment` — generated per enrolment from a FeeStructure; due date, amount, status.

### `Invoice` — code `INV-YYYY-NNNNNN`; sum of instalments; `Paise` totals.

### `Payment` — code, amount, method (`cash|cheque|bank_transfer|upi|other`), reference, receivedByUserId, allocations to instalments, optional `reversed` flag.

### `Receipt` — code `RCP-YYYY-NNNNNN`; PDF URL + Cloudinary key.

### `CreditNote` — issued on payment reversal.

## 6. Support

### `Ticket` — code `TKT-<CAT>-NNNNNN`; category (`academic|administrative|finance|technical|complaints`), state, assignee, SLA timestamps, attachments.

### `TicketComment` — body, `isInternal` flag, mentions.

## 7. Notifications

### `Notification` — per-recipient delivery row. Channel (`email|whatsapp|inapp`), idempotency key, retries.

### `NotificationPrefs` — per-user channel toggles per category.

## 8. Audit and operations

### `AuditLog` ([`models/auditLog.ts`](../../api/src/models/auditLog.ts))

The accountability backbone. See [../security/access-control.md](../security/access-control.md) §5.

| Field | Notes |
|---|---|
| `actorUserId` | nullable for system events |
| `action` | enum `AuditAction` |
| `targetType`, `targetId` | what was affected |
| `before`, `after` | scrubbed snapshots |
| `details` | free-form metadata |
| `ip`, `ua`, `at` | request context |

**Indexes**: `actorUserId+at`, `targetType+targetId+at`, `at`.

### `DomainEvent` — internal pub/sub-style events for cross-service workflow (course completion → certificate issue, etc.).

### `ApiCostLedger` — running cost ledger for email/WhatsApp/storage/certifier; supports admin analytics.

### `Counter` — single-row counters used for human-readable codes (User code, Invoice code, etc.).

## 9. Indexing principles

- Index lookup paths actually used by the application — typically `(userId, createdAt)`, `(targetType, targetId, at)`, status+role compound indices for filtered list pages.
- Use partial indices (`partialFilterExpression`) for fields that allow `null` to avoid spurious unique-collisions (e.g., `User.code`).
- Use TTL indices for ephemeral collections (`InviteToken.expiresAt`, `RefreshToken.expiresAt`).
- Every list endpoint should explain which index it relies on (in the route file or a code comment) — this is a documentation discipline, not a hard-enforced check.

## 10. Migrations

Mongoose schemas are loose by nature. Field additions with defaults are safe. Renames or shape changes require a backfill script in `api/scripts/`. See [../operations/change-management.md](../operations/change-management.md) §7.

## 11. Where to read more

- [../../claude-code-docs/03_TRD.md](../../claude-code-docs/03_TRD.md) — original schema spec.
- [../compliance/data-classification.md](../compliance/data-classification.md) — what's PII vs not.
- [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md) — how long each collection lives.
- [../compliance/ropa.md](../compliance/ropa.md) — what processing activity each collection serves.
- [../security/access-control.md](../security/access-control.md) — who can read what.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release that adds or modifies a collection._
