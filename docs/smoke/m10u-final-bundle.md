# M10u — Final code-only bundle (everything except Cloudinary + OTP)

**Decision:** [D-097](/memory/decisions.md).

## What changed

1. **Staff attendance module.** `StaffAttendance` model + `/v1/staff-attendance` routes + admin page + faculty self-mark widget on the dashboard.
2. **Apply Form step 3** now captures optional `parentGuardian` (name / relationship / phone / email).
3. **Field-level errors** on Login + Reset Password + Accept Invite — same pattern as signup.
4. **`sessionsHeldFrom` / `sessionsHeldTo`** filter on `GET /v1/reports/attendance`.
5. **Public visitor self-registration** at `/visitor-register` → `POST /v1/public/visitor/register` (IP rate-limited 5/hr; forces `otpVerificationStatus=pending`).
6. **TASKS.md cleanup** — stale entries marked done.

## Test plan

### A. Staff attendance
1. Log in as faculty. Dashboard shows the new "My attendance — today" card.
2. Click Present. Card flips to "Marked Present · last updated <time>". Re-tapping Late overwrites the row (no dupes).
3. Admin → Sidebar → "Staff attendance". The faculty member's row appears with status / date / who-marked-it.
4. Admin → "Mark attendance" → search a faculty → pick → set status Leave → notes → Save. Row appears in the list with admin as `markedByName`.
5. Filter by date range + status → list narrows correctly.
6. Student / unauthenticated → 403 on `/v1/staff-attendance`.

### B. Apply form parentGuardian
1. Open `/apply/signup` → create account.
2. On Step 3 (Contact), fill the new optional Parent/Guardian fieldset (name / relationship / phone / email).
3. Submit / save draft. Reload — fields persist.
4. (Admin) After applicant converts to student, `User.parentGuardian` should be populated from the apply draft.

### C. Field-level auth errors
1. `/login` with `password=""` → 422 → field error on Password ("Required" or "min length"), banner says "Please fix the highlighted fields below."
2. `/reset-password?t=invalid` submit → token field error if the server validates, else banner with server message.
3. `/accept-invite?t=invalid` submit short password → inline error "Password must be at least 10 characters."

### D. Sessions-held filter
1. `GET /v1/reports/attendance?batchId=X&from=2026-05-01&to=2026-05-31` → returns sessions in May.
2. Same plus `&sessionsHeldFrom=2026-05-15&sessionsHeldTo=2026-05-31` → returns only sessions whose `completedAt` (or `scheduledStart`) falls in the second window. `sessionCount` drops accordingly.

### E. Public visitor self-registration
1. Open `/visitor-register` in incognito (no login).
2. Fill the form → Submit. Confirmation page shown.
3. Admin → `/admin/visitor-leads` → new lead appears with `otpVerificationStatus=pending`, `status=new`, source from the dropdown.
4. Submit the form 6× quickly from the same IP → the 6th returns 429 `RATE_LIMITED`.
5. Try to override `otpVerificationStatus=verified` in the request body → server ignores; created lead is still `pending`.

## Roll-back

- Drop `/v1/staff-attendance` mount + delete the model + delete admin page + remove `SelfAttendanceCard` from FacultyDashboard.
- Remove `parentGuardian` fieldset from Step3Contact (DTO still accepts the field; UI just stops showing it).
- Revert `LoginPage` / `ResetPasswordPage` / `AcceptInvitePage` to single `error` state.
- Drop `sessionsHeldFrom` / `sessionsHeldTo` from `RangeScopedQuery` + remove the JS post-filter in `reportsService`.
- Drop `/v1/public/visitor/register` mount + delete `publicVisitor.ts` route + `VisitorRegisterPage`.
