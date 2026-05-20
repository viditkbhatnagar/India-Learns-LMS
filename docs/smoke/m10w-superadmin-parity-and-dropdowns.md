# M10w — Superadmin sidebar parity + reusable UserPicker dropdown

## Why

User reported (with screenshot): logged in as superadmin, the sidebar
shows "Finance" but **not** Record payment / Fee structures / Visitor
Leads / Staff attendance. The Admin & Faculty guide claimed those
items, so the guide looked wrong.

Root cause: every M10 nav addition (PR-R through PR-U) was added to the
`admin:` array in `AppShell.tsx`, but the parallel `superadmin:` array
was never updated. The two arrays had silently drifted.

Plus: the "Find the student" picker on Record Payment was a text input
with a dropdown-of-results pattern. User wanted a proper combobox.

## What changed

1. **`superadmin:` nav synced with `admin:`** — same 18 entries now,
   plus superadmin-only Curriculum import + Admissions. Going forward
   the two arrays should be kept in lockstep (or refactored into one
   shared list when next nav item lands).
2. **`<UserPicker>` reusable combobox** at `web/src/components/ui/UserPicker.tsx`.
   - Click to open, type to filter
   - Arrow keys to navigate, Enter to select, Esc to close
   - ✕ button to clear
   - Server-paginated search, role filter, optional predicate filter
3. **Record Payment** uses `<UserPicker role="student">`
4. **Staff Attendance mark-on-behalf** uses `<UserPicker filter={…staff roles}>`

## Smoke test

1. Log in as **superadmin@indialearns.test**.
2. Sidebar should now show, top-to-bottom: Dashboard · Users · Add &
   View Programs · Programs · Curriculum import · Batches · Timetable ·
   Tickets · Enrolments · **Visitor Leads** · **Staff attendance** ·
   Finance · **Record payment** · **Fee structures** · Admissions ·
   Reports · Placement · Chat · Announcements · Audit log.
3. Click **Record payment**. The "Find the student" card now shows a
   button that says "Pick a student…" with a chevron.
4. Click the button. A dropdown panel opens with a search box and a
   list of students. Type to filter; click a row to pick. The button
   updates to show the selected name; an ✕ button appears for clearing.
5. Click **Staff attendance** → **Mark attendance**. Same combobox UX,
   filtered to faculty + admin + superadmin roles.

## Roll-back

Single-file revert on `AppShell.tsx` to restore the old superadmin
array. UserPicker can stay (it's additive) or be reverted with the
matching changes in `FinancePayment.tsx` + `AdminStaffAttendance.tsx`.
