# M10r — Finance role removal + faculty content perms

**Decision:** [D-095](/memory/decisions.md).

## What changed

1. **`finance` role removed.** Admin handles every finance responsibility (record payments, issue receipts, view fees, manage fee structures, finance-category tickets). The `finance` ticket category survives as a subject-matter label; tickets in that category now route to admins tagged `deptTag='finance'` (falling back to any admin).
2. **Faculty content perms expanded** on assigned courses:
   - PATCH module `title` + `order` (was 403, now 200).
   - DELETE module (was admin-only, now faculty-allowed if assigned).
   - PATCH course `summary` (was admin-only, now faculty-allowed if assigned; structural fields like `name` / `slug` / `facultyIds` still 403 for faculty).

## Test plan

### A. Finance role gone

1. **Admin records a payment.**
   - Log in as admin → sidebar → "Record payment" → fill form → submit.
   - Expect: 201 response, receipt PDF downloadable. (Was finance-only before.)
2. **Old finance URLs still work for admin.**
   - Visit `/finance/dashboard`, `/finance/payments`, `/finance/students` while logged in as admin.
   - Expect: pages render. (No 403; URL kept for bookmark survival.)
3. **No "Finance" option when inviting a user.**
   - Admin → Users → "Invite user" → role dropdown.
   - Expect: options are Student / Faculty / Admin. No Finance.
4. **Student raises a fee question; admin gets it.**
   - Student → Tickets → New → category=Finance.
   - Expect: 201, ticket code `TKT-FIN-NNNNNN`. Admin sees it on `/admin/tickets`. If any admin has `deptTag='finance'`, the routing prefers them.
5. **No `/finance/*` URL via the role default redirect.**
   - The legacy default-route lookup for `finance` is gone; nothing should redirect to `/finance/dashboard` based on role.

### B. Faculty content perms

1. **Faculty assigned to a course can rename + reorder modules.**
   - Backend smoke (curl): `PATCH /v1/modules/<id>` with body `{ "title": "Renamed" }` from faculty bearer.
   - Expect: 200. Same for `{ "order": 3 }`.
2. **Faculty NOT assigned → 403.**
   - Same PATCH from a faculty who isn't in `course.facultyIds`.
   - Expect: 403 `FORBIDDEN`.
3. **Faculty assigned can DELETE a module.**
   - `DELETE /v1/modules/<id>` from assigned faculty bearer.
   - Expect: 200, module soft-deleted (`deletedAt` set).
4. **Faculty can PATCH course `summary` only.**
   - `PATCH /v1/courses/<id>` `{ "summary": "New summary" }` from assigned faculty → 200.
   - `PATCH /v1/courses/<id>` `{ "facultyIds": ["..."] }` from same faculty → 403 (`Faculty can only edit course summary`).
5. **Module videos / PDFs.**
   - Faculty already had this; just confirm via ContentTab UI on `/staff/courses/:id` → add a video block to a module on an assigned course → uploads land in GridFS (since M10q).

## Roll-back

- Re-add `'finance'` to `ROLES` enum and `User.role` Mongoose enum.
- Restore the `finance` branch in `AppShell` nav, `defaultRouteForRole`, BottomTabs.
- Restore `requireRole(..., 'finance', ...)` in payments / receipts / fee-structures / etc.
- For faculty perms: shrink `FACULTY_PATCH_FIELDS` back to remove `title` / `order`; revert `deleteModule()` admin-only check; revert `updateCourse()` admin-only gate.

All revertable file-by-file from the PR-R diff.
