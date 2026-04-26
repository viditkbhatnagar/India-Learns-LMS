# Finance Handbook

For LUC's finance team using India Learns to record payments, issue receipts, manage instalments, and report collections. Phase 1 has **no payment gateway** — payments arrive offline (bank transfer, UPI, cheque, cash) and you record them on the platform.

## 1. Sign in and dashboard

### 1.1 Sign in

`{{WEBSITE_URL}}/login`. After 10 wrong attempts in 15 minutes, your account is locked for 30 minutes.

### 1.2 Finance dashboard

`/finance/dashboard`

Cards:

- **Today's collections** — sum of payments recorded today.
- **This week** — running total.
- **This month** — running total.
- **Outstanding** — total ₹ across all unpaid instalments, broken down by overdue / due-soon / future.
- **Recent payments** — last 10 payments recorded (across all staff).

This is your morning view.

## 2. Searching for a student

### 2.1 List

`/finance/students`

Filters:

- **Outstanding > 0** — anyone with dues.
- **Overdue** — anyone past instalment due date.
- **Programme / batch** — narrow by cohort.
- **Search** — by name, email, or student code.

Click a row to open the student's finance page.

### 2.2 Student detail

`/finance/students/:id`

Sections:

- **Summary** — total due, total paid, outstanding.
- **Invoices** — every invoice raised (with code `INV-YYYY-NNNNNN`).
- **Instalments** — the payment schedule with due dates and status.
- **Payments** — every recorded payment with date, method, reference, recorder.
- **Receipts** — downloadable PDFs.

## 3. Recording a payment

### 3.1 Click "Record payment"

`/finance/students/:id/record-payment`

Fill in:

- **Amount** in ₹ (the platform stores it as integer paise — ₹1500.50 → 150050 paise).
- **Method** — `cash` / `cheque` / `bank_transfer` / `upi` / `other`.
- **Reference** — the bank reference number, UPI transaction ID, or cheque number.
- **Date** — the date of the actual payment (not today; finance often records a day later).
- **Notes** (optional) — anything memorable.
- **Allocate to instalments** — choose which instalment(s) the payment covers. The platform offers an oldest-first default.

### 3.2 Confirm

Review the summary on the next screen:

- Amount.
- Allocations.
- Whether this payment clears any fees-suspension.

Click **Record**. The platform:

1. Writes a `Payment` record.
2. Updates instalment statuses.
3. Generates a PDF receipt.
4. Stores the PDF on Cloudinary.
5. Sends the student a notification with the receipt link.
6. Audit-logs the action (`payment.recorded`).

### 3.3 If the student is fees-suspended

Recording a payment that brings the outstanding below the suspension threshold automatically lifts the suspension. The student can return to full access on next page load.

If you want to lift the suspension before payment is received (e.g., a confirmed bank transfer that hasn't cleared yet), use the **Override fees suspension** action with an end date — admin will review.

## 4. Reversing a payment

If you recorded a payment in error or it bounced:

1. Open the payment under `/finance/payments/:id`.
2. Click **Reverse**.
3. Provide a reason (mandatory).
4. Confirm.

The platform:

- Marks the original payment as `reversed`.
- Restores the instalment status to its prior state.
- Generates a credit note.
- Audit-logs `payment.reversed`.
- Notifies the student.

You **cannot** edit a payment in place — reverse and re-record. This protects the audit trail.

## 5. Receipts

Receipts are PDFs generated server-side via pdfkit. Each receipt includes:

- Receipt code (`RCP-YYYY-NNNNNN`).
- Issue date.
- Student name and code.
- Programme / batch.
- Line items (per instalment / component).
- Total.
- Org name, address, GSTIN (from env, currently `{{ORG_NAME}}` / `{{ORG_REGISTERED_ADDRESS}}` / `{{ORG_GSTIN}}` — to be confirmed).
- Issuer (your name).

### 5.1 Downloading

Click **Download** on any receipt row. The download URL is signed and expires in **5 minutes**.

### 5.2 Sharing with students

Students see their receipts on their `/student/fees` page. They don't need you to send the PDF — the platform link is canonical.

If they need a paper copy, print and stamp from your end.

## 6. Reports

`/finance/reports`

- **Collections by period** — daily / weekly / monthly aggregates.
- **Collections by method** — breakdown across cash / cheque / UPI / bank transfer.
- **Outstanding by batch** — which cohort owes the most.
- **Aged outstanding** — how old the overdue amounts are.

Reports are generated on demand. For a snapshot, click **Export CSV**.

## 7. Fees-suspension lifecycle

The autosuspend cron runs once a day (03:30 IST):

- Identifies students with overdue ≥ N days (per programme rules).
- Fires warning notifications first.
- Applies fees suspension after the cure period.

Students see warnings before suspension. When you record a payment that clears the threshold, the suspension lifts automatically.

If you need to negotiate a payment plan, advise the student to raise a Finance ticket; you can then **override the suspension** for the agreed window.

## 8. Tickets you handle

Finance receives tickets in the **Finance** category:

- Refund requests.
- Payment-not-reflected issues.
- Instalment renegotiation requests.
- Receipt corrections.

Open `/staff/tickets` (filtered to your assignments). Use internal comments for back-and-forth with admin; reply publicly to the student.

## 9. Common issues

| If… | Try this |
|---|---|
| The student says they paid but you can't see the payment | The bank may not have cleared. Wait 24 hours. If still missing, ask for the bank reference. |
| You recorded the wrong amount | Reverse and re-record. Don't try to "edit". |
| The receipt PDF won't download | Check the signed URL hasn't expired (5 min TTL). Click **Download** again to mint a fresh one. |
| The student claims their suspension didn't lift | Confirm the threshold (programme-specific). If the payment cleared the threshold, ask the student to refresh; the next access-token refresh picks it up. |
| You can't open Cloudinary | Cloudinary is the storage provider. If down, the receipt cannot be downloaded but the data is intact. Wait or contact Vidit. |
| GSTIN on the receipt is wrong | The GSTIN comes from `RECEIPT_ORG_GSTIN` env. Updates require a Render redeploy by Vidit. |

## 10. Privacy and audit responsibilities

- **Every payment you record is auditable.** The audit log captures actor, amount, allocations, before/after of the invoice/instalment.
- **Don't share receipt PDFs externally.** They contain student name, address, and amounts — full PII + financial data.
- **Don't bypass the platform.** Recording a payment outside the platform breaks the audit trail and the student-facing receipt experience.
- **Be careful with internal ticket comments.** They're meant for staff, not students; don't accidentally write to a public comment.

## 11. Tax records and retention

Receipts, invoices, and payment records are retained for **8 years** per Indian tax norms (see [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md)). Even if a student requests erasure, financial records are anonymised — the line items remain for tax purposes.

## 12. Where to go next

- [Admin handbook](admin-handbook.md) — for non-finance admin tasks.
- [Refund Policy](../legal/refund-policy.md) — when a student asks for a refund.
- [Privacy Policy](../legal/privacy-policy.md) — public-facing data handling.
- [Operations runbook](../operations/on-call-runbook.md) — when the platform is misbehaving.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with LUC finance. Review cadence: per release._
