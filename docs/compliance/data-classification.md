# Data Classification

A handling guide for every data category in India Learns. The four-tier model groups data by sensitivity and prescribes the controls each tier requires. Engineers, support staff, and auditors should use this when adding a new field, exporting data, debugging, or reviewing a finding.

## Tiers

| Tier | Name | Examples in India Learns | Default handling |
|---|---|---|---|
| **T1** | Sensitive personal data | Financial fields (invoices, payments, receipts); free-text complaint tickets; exam answer text; audit `before/after` JSON | Auth + role + owner check + audit; never logged in plaintext; never copy-pasted into chat or AI tools |
| **T2** | Personal data | Name, email, E.164 phone, postal address, role, programme/batch link, lockout/login metadata; refresh-token metadata (deviceId, IP, UA) | Auth + role; no plaintext in error responses; redacted in support screenshots |
| **T3** | Internal data | Course catalogue, programme metadata, timetable rules, rubric definitions, fee structures (without student linkage), holiday calendar | Auth required; not for the open internet but no special handling |
| **T4** | Public data | Brand and marketing copy, public landing pages, certificate verification URLs (when issued) | No restrictions |

## Field-level classification per model

The unit of analysis is the **field**, not the model — a model often holds multiple tiers.

### `User` ([`api/src/models/user.ts`](../../api/src/models/user.ts))

| Field | Tier | Notes |
|---|---|---|
| `_id`, `code` | T2 | Stable identifiers — pseudonymous to non-staff |
| `role`, `status`, `suspensionKind`, `deletedAt` | T2 | Operational |
| `name`, `email`, `phoneE164`, `address` | T2 | Direct identifiers |
| `passwordHash`, `passwordHistoryHashes` | **Never exposed** | Stripped by `User.toJSON` and `auditService.scrubUser` |
| `loginFailCount`, `lockedUntil` | **Never exposed** | Same scrubber path |
| `lastLoginAt`, `passwordUpdatedAt` | T2 | Useful for support but PII-adjacent |
| `programId`, `batchId`, `enrolmentValidFrom/To`, `deptTag` | T3 | Operational |

### `RefreshToken` ([`api/src/models/refreshToken.ts`](../../api/src/models/refreshToken.ts))

| Field | Tier | Notes |
|---|---|---|
| `tokenHash` | T1 | Hash only; plaintext never stored |
| `deviceId`, `ua`, `ip` | T2 | Forensic and per-session metadata |
| `familyId`, lifecycle dates | T3 | Operational |

### `Invoice`, `Payment`, `Receipt`, `FeeStructure`, `FeeInstallment`, `CreditNote`

| Field class | Tier |
|---|---|
| Money in paise | T1 |
| Method, reference, payer-if-different | T1 |
| Issue dates, status | T2 |
| PDF URL or storage key | T1 (PDF contains PII + financial info) |

Receipt PDFs hold name, address, GSTIN of org, line-items. They are issued only by finance staff and are accessible via signed URL with a 5-minute TTL.

### `Ticket`, `TicketComment`

| Field | Tier | Notes |
|---|---|---|
| `description`, `comments[].body` (public) | T1 if category = `complaints`, else T2 | Free-text often contains personal narrative |
| `comments[].body` (internal) | T1 | Visible only to staff |
| `attachments` (Cloudinary keys) | T1 | Could be anything |
| State, SLA timestamps | T3 | Operational |

### `AuditLog`

| Field | Tier |
|---|---|
| `before`, `after` | **Composite** — tier mirrors the underlying object after `scrubUser` strips passwords/lockouts |
| `actorUserId`, `targetUserId`, `ip`, `ua` | T2 |
| `action`, `targetType`, `at` | T3 |

### `Quiz`, `QuizAttempt`, `Exam`, `ExamAttempt`, `Assignment`, `AssignmentSubmission`

| Field | Tier |
|---|---|
| Question banks, rubric definitions | T3 |
| Per-student answers (especially essay text) | T1 |
| Per-student scores, grades, feedback | T2 |

### `Enrollment`, `Program`, `Course`, `Module`, `Session`, `Material`, `Batch`, `Holiday`, `TimetableEntry`, `TimetableOverride`

Mostly T3. Linked student `userId` fields move the row toward T2 in scope of "who is enrolled" but not in content.

### `Notification`, `NotificationPrefs`

| Field | Tier |
|---|---|
| `body`, `html`, `text` | T2 (could include T1 if templated with financial info — e.g., "Your fee of ₹X is overdue") |
| `to` (email/phone) | T2 |
| Preference toggles | T3 |

### `ApiCostLedger`

| Field | Tier |
|---|---|
| Counts and currency totals | T3 — no per-user attribution |

## Handling rules per tier

### T1 — Sensitive

- **Storage:** in MongoDB Atlas only (encrypted at rest), or in Cloudinary as `type: authenticated` with signed-URL access.
- **Display:** only to the data principal or to role-authorised staff (e.g., finance for financial fields).
- **Logs:** never logged in plaintext. If a debug message references the field, log only a stable identifier (e.g., `paymentId`).
- **Audit:** every read/write by staff is auditable when state-changing.
- **Export / sharing:** prohibited outside the platform unless via a documented procedure (DSAR, finance reconciliation).
- **AI tools / pastebins / screenshots:** prohibited. Redact before any external share.

### T2 — Personal

- **Storage:** same as T1; encryption at rest is sufficient.
- **Display:** to the data principal or to role-authorised staff for operational reasons.
- **Logs:** structured logs may include T2 if necessary for debugging (e.g., `userId`), but free-text PII (`address`, `phoneE164`) should not be logged.
- **Audit:** state changes are audited; reads are not.
- **Export:** only via approved channels.

### T3 — Internal

- **Storage:** standard.
- **Display:** to authenticated users.
- **Logs:** may be logged.
- **Export:** subject to LUC's product confidentiality preferences but not regulatory.

### T4 — Public

- **No restrictions.**

## Adding new fields

When you add a field to a model, classify it in this document at the same time. The PR review checklist (in [../security/secure-sdlc.md](../security/secure-sdlc.md) §5) includes this step.

## Cross-references

- [data-retention-policy.md](data-retention-policy.md) — how long each tier is retained.
- [ropa.md](ropa.md) — what activity introduces each field.
- [../security/cryptography.md](../security/cryptography.md) — what gets encrypted at the field level.
- [../security/access-control.md](../security/access-control.md) — who can read what.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (interim DPO). Review cadence: per release._
