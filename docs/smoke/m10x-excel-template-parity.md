# M10x — Excel template parity bundle

Closes the three gaps from Logan's `Student_Fee_Structure_and_Schedule.xlsx`
template + the recommendation to surface them in the existing FinanceStudentDetail page.

## What changed

1. **`User.source` field** — Marketing source attribution.
   - New optional field reusing `VisitorLeadSource` enum.
   - Surfaced on the invite form (admin → Users → Invite) and on the
     user detail page (admin → Users → click student → Marketing source card).
   - Default `null`; admin sets it when they know.
2. **`FeeInstallment.dueLabel` field** — Milestone-based due dates.
   - "Seat Reservation" / "Upon Admission" can now display literally
     instead of a calendar date.
   - When set, the installments list shows the orange-highlighted label
     in place of the date; the underlying `dueDate` still exists for
     sorting + reminders.
   - Editable on the inline installment edit form and on the
     "Add installment" form on Finance → Students → [student].
3. **`Enrollment.declaredTotalPaise` field** — Excel "Total Fees Specified".
   - Admin types the upfront expected total on the new
     `<DeclaredTotalCard>` at the top of FinanceStudentDetail.
   - Page warns with an amber banner when the computed installment sum
     differs by ≥ ₹1 from the declared total.

## Smoke test (recreate Athira's Excel record)

### Step 1 — capture as visitor lead
Sidebar → **Visitor Leads** → Add lead. Name=Athira, Phone, Lead Source=`meta`. Save.

### Step 2 — invite as student
Sidebar → **Users** → "Invite a user".
- Basics: Athira, email, +91 phone, program "Retail & Fashion Diploma", batch.
- DOB row and the new **Source** dropdown — pick "Meta (FB / IG ads)" so the attribution carries over.
- Optional collapsible cards: address, emergency contact, parent / guardian.
- Send invite.

### Step 3 — declare total fees
Sidebar → **Finance** → click Athira.
- The new **Total Fees Specified** card → type `131500` → Save.

### Step 4 — set up the installment schedule
- Click "Generate from template" (or use the auto-gen if a FeeStructure is linked).
- For "Registration Fee", click Edit → set Milestone to `Seat Reservation` → Save. The row now shows the orange "Seat Reservation" label instead of the date.
- For "Admission Fee", click Edit → set Milestone to `Upon Admission` → Save.
- Tuition installments (with calendar dates) stay as auto-gen rows.

### Step 5 — verify variance check
- If the computed sum doesn't equal 131,500, the amber banner appears: "Declared ₹131,500 ≠ computed …".
- Add / waive rows until the sum matches.

### Step 6 — record payments
Sidebar → **Record payment** → "Pick a student…" → Athira → enter amount + method → "Record payment & issue receipt". Allocated to oldest pending installment, receipt PDF generated.

## Roll-back

Three field-level reverts:
- `User.source` — schema field + DTO + invite form + SourceEditor.
- `FeeInstallment.dueLabel` — schema field + DTO + InstallmentEditForm / CreateForm + list-row rendering.
- `Enrollment.declaredTotalPaise` — schema field + DTO + adminEnrollmentsApi.update + DeclaredTotalCard.

All three are additive non-breaking changes; revert each independently if needed.
