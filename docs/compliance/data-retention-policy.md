# Data Retention Policy

How long India Learns retains each category of data, why, and what triggers deletion. The policy is set so that we can comply with DPDP Act 2023 § 8(3) — cease retention when the purpose has been served and no legitimate-interest hold applies — while honouring statutory record-keeping obligations (tax, regulatory, audit).

> **Status:** Policy fixed; automated enforcement is partial. Where automation is missing, the deletion is currently a manual quarterly task (see §3).

## 1. Retention table per collection

| Collection | Retention period | Trigger to start the clock | Action at end of period | Reason |
|---|---|---|---|---|
| `User` (active) | While account active | n/a | n/a | Operational |
| `User` (revoked, soft-deleted) | 90 days `deletedAt + 90d` | Soft-delete by admin | Hard delete (or anonymise) of identity fields | Allows mistake reversal, then ceases retention |
| `RefreshToken` | `expiresAt + 30 days` | Token expiry or revoke | Hard delete | Forensic context for token reuse cases |
| `InviteToken` | `expiresAt + 7 days` | TTL or consumption | Hard delete | Single-use; brief tail for abuse review |
| `Session` | While linked refresh token active | n/a | Hard delete cascade | Operational |
| `Program`, `Course`, `Module`, `Batch`, `Holiday`, `TimetableEntry`, `TimetableOverride`, `Material` | While LUC offers the offering + 5 years | Discontinuation date | Soft-archive (read-only flag) | Academic record preservation |
| `Enrollment` | Lifetime of student account + 5 years from completion | `completedAt` | Soft-archive | Academic record preservation |
| `Assignment`, `AssignmentSubmission`, `Quiz`, `QuizAttempt`, `Exam`, `ExamAttempt`, `Rubric`, `FeedbackEntry` | 5 years from `createdAt` of the most recent attempt | Submission timestamp | Hard delete | Academic record + reasonable dispute window |
| `Invoice`, `FeeInstallment`, `Payment`, `Receipt`, `CreditNote`, `FeeStructure` | **8 years** from issue | Document `issuedAt` | Hard delete | Indian tax record-keeping convention; longer than DPDP minimum |
| `Ticket`, `TicketComment` | While related enrolment active + 7 years from final state | `closedAt` | Hard delete | Dispute and grievance window |
| `Notification` | 1 year from `createdAt` | Send timestamp | Hard delete | Delivery debugging window |
| `NotificationPrefs` | While account active | n/a | Cascade with User | Operational |
| `AuditLog` | **7 years** | `at` | Hard delete | Financial and regulatory standard |
| `DomainEvent` | 90 days | Emit timestamp | Hard delete | Operational debug; not a permanent log |
| `ApiCostLedger` | 7 years | `at` | Hard delete | Cost-reconciliation history |
| `Counter` | n/a (single-row counters) | n/a | n/a | Operational |
| `Cloudinary assets` (receipts, materials, attachments) | Mirrors the linked DB row | Linked row deletion | Provider deletion via adapter | Cleaning up leaves provider in sync |

## 2. Triggers and overrides

### 2.1 Legitimate-interest hold

Retention is paused (and a record kept) when:

- The data is subject to active litigation or regulatory inquiry.
- Law enforcement or a regulator has issued a preservation order.
- A material accounting issue is under reconciliation.

Holds are recorded in a manual register maintained by the DPO until a holds-collection is built.

### 2.2 Erasure on request

When a Data Principal exercises the right to erasure under DPDP § 12, the procedure is:

1. Verify identity per [dsar-procedure.md](dsar-procedure.md).
2. Confirm none of the legitimate-interest holds apply.
3. Confirm regulatory retention has lapsed (e.g., financial records held under tax law may not be erased before 8 years).
4. Where erasure can proceed, anonymise rather than hard-delete on financial records (replace `studentId` with a tombstone token; keep paise totals for tax).
5. For non-financial records, hard-delete.

If full erasure cannot proceed because of statutory retention, the user is informed of the residual records and the date of their eventual deletion.

### 2.3 Backups

Atlas backups inherit the cluster's encryption-at-rest. Backup snapshots cannot be selectively edited — when a record is deleted from the live cluster, backups taken before the deletion still contain it. Documented in [../operations/backup-and-dr.md](../operations/backup-and-dr.md). Backups roll off after **30 days** at the Atlas Standard plan level; older snapshots are unrecoverable.

For erasure requests, this means: deletion in the live cluster is immediate, but the deleted record will continue to exist in backup snapshots until the oldest snapshot covering it has rolled off (≤ 30 days).

## 3. Enforcement

### 3.1 Automated (today)

- **`InviteToken` and password-reset tokens** — TTL index removes documents at `expiresAt`.
- **`RefreshToken`** — TTL index on `expiresAt`.

### 3.2 Manual (quarterly, until automated)

Until a retention-sweep cron is built:

- Once per quarter, the DPO runs a script that lists rows older than the retention period and submits a deletion PR for review. Owners: DPO + Vidit.

### 3.3 Planned automation

A new cron job `il-cron-retention-sweep` is on the roadmap to:

- Iterate the retention table.
- Hard-delete or anonymise rows past their retention window.
- Emit `retention.swept` audit entries with counts only (no PII).
- Run weekly off-hours.

This is tracked in `TASKS.md` for Phase 2.

## 4. Special collections

### 4.1 Audit log

Audit logs must be retained but must also be subject to *some* outer bound to comply with DPDP § 8(3). Seven years matches the financial-records standard and is well above DPDP minimums. After 7 years, audit rows are hard-deleted.

If an audit row is *itself* requested for erasure (e.g., a Data Principal disputes a record about them), the row is anonymised: `actorUserId` and `targetId` replaced with stable tombstones, `before/after` further scrubbed of identifiers, while preserving `action` and `at` for analytics.

### 4.2 Receipts

Receipts must be retained 8 years for Indian tax purposes regardless of an erasure request. We anonymise rather than delete on erasure: the line items remain, the student linkage is replaced with a tombstone.

### 4.3 Tickets in the `complaints` category

A `complaints` ticket (DPDP § 13 grievance) is retained 7 years even after the related enrolment ends. Anonymisation rules per §2.2 apply.

## 5. Reporting

The DPO produces a quarterly retention report:

- Counts of records hard-deleted per collection in the prior quarter.
- Holds in force.
- Erasure requests received and outcomes.
- Backups rolled off.

The report is appended to the compliance pack and shared with LUC leadership.

## 6. Cross-references

- [ropa.md](ropa.md) — purpose and lawful basis per activity.
- [data-classification.md](data-classification.md) — tier per field.
- [dsar-procedure.md](dsar-procedure.md) — handling rights requests.
- [../operations/backup-and-dr.md](../operations/backup-and-dr.md) — backup retention.
- [dpdp-compliance-report.md](dpdp-compliance-report.md) §1 — § 8(3) mapping.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO). Review cadence: every quarter; immediate review on any new collection._
