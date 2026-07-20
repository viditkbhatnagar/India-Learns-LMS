# Smoke — Faculty logins (admin-created, generated passwords) + course roster

**Feature:** Admins create faculty logins with an auto-generated password shown
in a credentials table; the teacher signs in and lands on their dashboard.
Faculty also get a real "students in my course" roster (previously a stub).

## What was built

- **Admin → Faculty** section (`/admin/faculty`, `web/src/pages/admin/AdminFaculty.tsx`):
  enter Name + Email + Phone → **Create login** → the generated password appears
  in the table (persisted, always visible). Per-row **Reset password** and copy.
- **API** `POST /v1/faculty` (create, returns `temporaryPassword`), `GET /v1/faculty`
  (list with decrypted passwords + course counts), `POST /v1/faculty/:id/reset-password`
  — all `requireRole('admin','superadmin')` (`api/src/routes/faculty.ts`,
  `services/facultyAccountService.ts`).
- **Password storage:** generated with a CSPRNG (`utils/generatePassword.ts`),
  hashed (Argon2id) for login, AND stored **encrypted at rest** (AES-256-GCM,
  `utils/secretBox.ts`, key `CREDENTIALS_ENC_KEY`) in a dedicated
  `facultycredentials` collection — decrypted only for the staff-gated list.
- **Course roster:** `GET /v1/courses/:id/students` (assigned faculty + admin)
  → the real **Students tab** (`web/src/pages/staff/tabs/CourseStudentsTab.tsx`),
  replacing the "coming soon" stub. Faculty dashboard "Students" tile now shows a
  real count.

## Config (required before use)

Set `CREDENTIALS_ENC_KEY` to a strong random string (≥24 chars):

```bash
# local (api/.env):
CREDENTIALS_ENC_KEY="$(openssl rand -base64 48)"
# prod: add the same key to Render → il-app → Environment.
```

Without it, faculty create/list return a clear `503 CREDENTIALS_NOT_CONFIGURED`.
In production, a *set-but-weak* (<24 char) key fails boot; leaving it empty just
disables the feature.

## Manual walkthrough

1. Set `CREDENTIALS_ENC_KEY`. Log in as **admin/superadmin** → sidebar **Faculty**.
2. Create a faculty (Name + Email + Phone) → row appears with a generated
   **password** (reveal/copy). Copy email + password.
3. **Log in as that faculty** at `/login` with the email + generated password →
   lands on `/faculty/dashboard`.
4. As admin, open a course → **Overview → Teaching faculty** → add that faculty.
   Enrol a student into the course (Admin → Enrolments).
5. Back as the faculty → open the course → **Students** tab shows the enrolled
   student. Dashboard "Students" tile shows the count.
6. Admin: **Reset password** on a row → new password shown; old sessions revoked;
   new password logs in.
7. A **student**/non-admin gets 403 on `/v1/faculty`; a faculty gets 403 on a
   course's `/students` they aren't assigned to.

## Automated coverage

- `tests/unit/secretBox.test.ts` — seal/open round-trip, tamper (GCM), malformed.
- `tests/unit/generatePassword.test.ts` — always satisfies the password policy.
- `tests/unit/facultyAccountService.test.ts` — create (active + working password +
  encrypted-not-plaintext), list (decrypted password + course count), reset
  (new works / old rejected), duplicate-email + non-admin rejection.
- `tests/integration/faculty.test.ts` — create→**real login round-trip**, list,
  reset, student 403 / unauthenticated 401.
- `tests/integration/courseStudents.test.ts` — assigned faculty + admin 200,
  unassigned faculty + student 403.

## Security notes (persist-and-show tradeoff)

Recoverable password storage is a deliberate product decision. Mitigations:
encrypted at rest (key only in env), isolated collection, staff-only decrypt,
soft-deleted students excluded from rosters, sessions revoked on reset, plaintext
never in DTO/logs/audit. Residual accepted risk: any admin (and the app server)
can read faculty passwords — use a strong `CREDENTIALS_ENC_KEY` and encourage
faculty to change their password after first login.
