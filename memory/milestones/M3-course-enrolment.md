# M3 — Course + enrolment core

**Date completed:** 2026-04-21
**Supersedes:** — (extends M2 auth + user management)
**Test result:** 25 files / 120 tests green · services coverage ≥ 70% lines (exceeds 70/70/55 gate).

**Post-implementation review corrections** (2026-04-21):
- **D-035** — `GET /v1/me/courses/:courseId` was leaking module URLs to fee-suspended or date-expired students. Extracted a shared `assertStudentCanAccessCourse` and routed both the catalog and per-module endpoints through it. New `tests/integration/meCourses.test.ts` covers all 5 gate cases end-to-end.

## What was built

Server-only academic surface: Program → Course → Module, plus Batch + Enrolment, a StorageAdapter abstraction, and the student dashboard aggregation endpoint.

- **Models** (all `mongoose.models.X ?? model(...)` per D-018):
  - `Program` — `{ name, slug(unique), description, totalHours (default 300), isActive, deletedAt }`. See [api/src/models/program.ts](../../api/src/models/program.ts).
  - `Course` — `{ programId, name, slug, summary, state: 'sandbox'|'published', publishedAt, publishedVersion, sequential, certificateTemplateId, facultyIds[], deletedAt }`. Compound `{programId, slug}` unique. See [api/src/models/course.ts](../../api/src/models/course.ts).
  - `Module` — `{ courseId, title, order, content[], deletedAt }`. Content subdoc has `{ kind: 'video'|'pdf'|'text'|'quizRef', title, videoUrl, pdfUrl, pdfStorageKey, allowDownload, textMarkdown, quizId }`. Unique `{courseId, order}` filtered to non-deleted rows. Exported as `ModuleModel` to avoid shadowing Node's built-in. See [api/src/models/module.ts](../../api/src/models/module.ts).
  - `Batch` — `{ programId, name, startDate, endDate, capacity (default 30), status, coordinators[], deletedAt }`. See [api/src/models/batch.ts](../../api/src/models/batch.ts).
  - `Enrollment` — `{ studentId, batchId, courseId, programId, validFrom, validTo, status, accessState, completed, completedAt, certificateUrl, certificateIssuedAt }`. Unique `{studentId, courseId}` filtered to `status:'active'` — this is the PRD §7.2 "one active enrolment per course" guarantee. See [api/src/models/enrollment.ts](../../api/src/models/enrollment.ts).

- **Services** (all under `api/src/services/`):
  - `programService` — CRUD, slug uniqueness, soft-delete blocked while courses exist (409 `PROGRAM_IN_USE`).
  - `courseService` — CRUD + `publishCourse` (bumps `publishedVersion`, sets `publishedAt`) + `unpublishCourse`. `facultyAssignedToCourse(course, userId)` helper reused by modules + storage routes.
  - `moduleService` — CRUD with whitelisted patch fields: `ADMIN_PATCH_FIELDS = {title, order, content}` vs `FACULTY_PATCH_FIELDS = {content}`. `normalizeContent` validates each kind (video requires videoUrl, pdf requires url/key, text requires textMarkdown, quizRef requires quizId).
  - `moduleAccessService.assertStudentCanViewModule` — 6-step gate (D-026): course loaded → published → active enrolment exists → program matches → validTo not past (flips to `expired` as a side-effect) → accessState ≠ 'suspended'. `recordModuleViewed` writes the `module.viewed` audit entry on the happy path only.
  - `batchService` — CRUD with endDate > startDate validation, capacity-shrink guard (`BATCH_FULL`), delete blocked while active enrolments exist (`BATCH_IN_USE`).
  - `enrollmentService.enrolStudentInProgram` — creates N enrolments in parallel (one per published/sandbox course in the program). Rejects duplicates (`ENROLLMENT_DUPLICATE`), over-capacity (`BATCH_FULL`), program/batch mismatch. Also syncs `User.programId/batchId/enrolmentValidFrom/enrolmentValidTo` for downstream convenience.
  - `studentDashboardService.buildStudentDashboard` — returns `{ student, enrolments, nextClass, outstandingFees, openTickets, newFeedback }` with `stub: true` buckets for M4–M7.
  - `storageService.requestUploadTicket` — role + folder + course-assignment gating; delegates to `getIntegrations().storage.signedUploadTicket()`.

- **Integrations**:
  - `StorageAdapter` interface added in [packages/shared-types/src/integrations.ts](../../packages/shared-types/src/integrations.ts) — `upload/delete/signedUrl/signedUploadTicket`.
  - `ConsoleStorageAdapter` (dev/test default, logs via pino, returns fake URLs) + `CloudinaryStorageAdapter` (class stub that throws until `CLOUDINARY_*` env is set and SDK wiring lands in M5). See [api/src/integrations/storageAdapter.ts](../../api/src/integrations/storageAdapter.ts).
  - Factory in [api/src/integrations/index.ts](../../api/src/integrations/index.ts) now returns `{email, whatsapp, storage}`. `setIntegrations()` accepts a partial override so existing M2 tests (email+whatsapp only) still compile.

- **Routes** (all under `requireAuth`):
  - `/v1/programs` (admin CRUD; faculty/superadmin read-only).
  - `/v1/courses` with `/publish` + `/unpublish` + `/:id/modules` sub-routes; faculty see only assigned courses (`facultyAssignedToCourse`).
  - `/v1/modules/:id` — GET is role-aware (student goes through the access gate, faculty through the assignment check, admin/superadmin pass). PATCH/DELETE gated per role with whitelist fields.
  - `/v1/batches` (admin CRUD; faculty/superadmin read).
  - `/v1/enrollments` (admin POST creates N), `/v1/enrollments/me` (student), `/v1/enrollments/:id` (admin PATCH including `status='revoked'` and `accessState`).
  - `/v1/me/courses` + `/v1/me/courses/:courseId` (student, alias of `/v1/enrollments/me` per D-031 + course detail).
  - `/v1/students/me/dashboard` (student only — admin 403s).
  - `/v1/storage/upload-url` (admin or faculty-on-assigned-course).

- **Shared types**: new `COURSE_STATES`, `BATCH_STATUSES`, `ENROLLMENT_STATUSES`, `ENROLLMENT_ACCESS_STATES`, `MODULE_CONTENT_KINDS`, `STORAGE_FOLDERS`. `AUDIT_ACTIONS` extended with 16 M3 verbs including `module.viewed` (D-029). Full DTO set in [packages/shared-types/src/dto/course.ts](../../packages/shared-types/src/dto/course.ts) + [dto/storage.ts](../../packages/shared-types/src/dto/storage.ts).

- **Error middleware**: extended Mongo-duplicate handler in [api/src/middleware/error.ts](../../api/src/middleware/error.ts) to map `slug`-dup → `SLUG_EXISTS` (409) and `{studentId, courseId}`-dup → `ENROLLMENT_DUPLICATE` (409). New domain codes thrown by services: `NOT_ENROLLED`, `ENROLMENT_EXPIRED`, `BATCH_FULL`, `BATCH_IN_USE`, `COURSE_IN_USE`, `COURSE_ALREADY_PUBLISHED`, `COURSE_NOT_PUBLISHED`, `PROGRAM_IN_USE`.

- **Seed script** ([api/scripts/seed.ts](../../api/scripts/seed.ts)): upserts two Phase 1 programs (Aviation Diploma, Retail & Fashion Diploma) by slug. Idempotent. `npm run seed -w api`.

- **Tests** (11 new files):
  - **Unit:** `moduleAccessService.test.ts` (all 6 gate steps + `module.viewed` audit), `enrollmentService.test.ts` (N-enrolments, duplicate, batch-full, non-admin, program mismatch, revoke).
  - **Integration:** `programs.crud.test.ts`, `courses.crud.test.ts`, `modules.crud.test.ts` (admin structural vs faculty content-only), `batches.crud.test.ts`, `enrollments.test.ts` (including `/me/courses` alias), `modules.access.test.ts` (the linchpin — 6 gate cases end-to-end via HTTP), `studentDashboard.test.ts`, `storage.test.ts`, `seed.test.ts` (idempotency).

## API surface mounted

**`/v1/programs`** — admin CRUD, read for admin/superadmin/faculty.
**`/v1/courses`** — admin CRUD + `/publish`, `/unpublish`, `/:id/modules` (GET list, POST admin-only). Faculty see only own.
**`/v1/modules/:id`** — role-aware GET (student gated), PATCH (admin structural / faculty content), DELETE admin.
**`/v1/batches`** — admin CRUD, read for admin/superadmin/faculty.
**`/v1/enrollments`** — POST admin (creates N), GET admin+superadmin, PATCH admin, `/me` for students.
**`/v1/me/courses`** — student enrolments + per-course detail (alias of `/v1/enrollments/me`).
**`/v1/students/me/dashboard`** — student-only aggregated payload with M4–M7 stub buckets.
**`/v1/storage/upload-url`** — admin / assigned-faculty gets a signed upload ticket (stub URL today).

All success responses wrapped in `{data: ...}` per TRD §5; errors in `{error: {code, message, details?}}`.

## Tests (115 / 115 green)

24 test files. Coverage on `api/src/services/**`: 81.89% lines, 93.2% functions, 63.55% branches — clears the 70/70/55 gate from [api/vitest.config.ts](../../api/vitest.config.ts).

New coverage highlights:
- `moduleAccessService.ts` — 100% lines / 87.5% branches.
- `storageService.ts` — 95.45% lines.
- `studentDashboardService.ts` — 93.75% lines.
- `programService.ts` — 89.5% lines.

## Files changed / added

**New (models)**:
- `api/src/models/{program,course,module,batch,enrollment}.ts`

**New (services)**:
- `api/src/services/{programService,courseService,moduleService,moduleAccessService,batchService,enrollmentService,studentDashboardService,storageService}.ts`

**New (routes)**:
- `api/src/routes/{programs,courses,modules,batches,enrollments,meCourses,studentDashboard,storage}.ts`

**New (integrations)**:
- `api/src/integrations/storageAdapter.ts`

**New (scripts)**:
- `api/scripts/seed.ts` + `seed` npm script in [api/package.json](../../api/package.json)

**New (shared-types)**:
- `packages/shared-types/src/dto/{course,storage}.ts`

**New (tests + helpers)**:
- `api/tests/helpers/auth.ts` (bearer-token helper for integration tests)
- `api/tests/unit/{moduleAccessService,enrollmentService}.test.ts`
- `api/tests/integration/{programs.crud,courses.crud,modules.crud,batches.crud,enrollments,modules.access,studentDashboard,storage,seed}.test.ts`

**Modified**:
- `api/src/models/index.ts` — re-export new models.
- `api/src/models/user.ts` — `code` field unique index replaced with `partialFilterExpression: { code: { $type: 'string' } }` (D-034). Drops `sparse: true` in favour of the partial index; null-code users now coexist.
- `api/src/routes/index.ts` — mount 8 new routers after `/auth` + `/users`.
- `api/src/integrations/index.ts` — factory now returns `{email, whatsapp, storage}`; `setIntegrations()` signature widened to accept a partial override (keeps M2 tests green).
- `api/src/middleware/error.ts` — Mongo 11000 handler maps slug + enrolment duplicate keys.
- `api/tests/helpers/factories.ts` — added `makeProgram/makeCourse/makeModule/makeBatch/makeEnrollment` + `makeStudent`/`makeFaculty`.
- `api/tests/helpers/integrations.ts` — added `SpyStorageAdapter` and wired it into `useIntegrationSpies`.
- `packages/shared-types/src/enums.ts` — appended M3 enums + 16 audit action codes.
- `packages/shared-types/src/integrations.ts` — `StorageAdapter` + related input/result types. `StorageUploadInput.bytes` is `Uint8Array` (not `Buffer`) so shared-types stays browser-safe.
- `packages/shared-types/src/index.ts` — re-export `dto/course` + `dto/storage`.

## Example curl flow (DoD smoke)

Assumes `MONGODB_URI` is live, API running on `:4000`, and M2 superadmin seeded per the M2 runbook.

```bash
# 1. Seed Phase 1 programs — idempotent
MONGODB_URI="$MONGODB_URI" npm run seed -w api
# → "programs seeded" {inserted: 2, skipped: 0}. Run again: {inserted: 0, skipped: 2}.

# 2. Admin login
export AT=$(curl -sS -c cookies.txt -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@luc.local","password":"Admin#12345","deviceId":"dev-1"}' \
  | jq -r .data.accessToken)

# 3. List seeded programs
curl -sS http://localhost:4000/v1/programs -H "authorization: Bearer $AT" \
  | jq '.data.items[].slug'
# → "aviation-diploma"  "retail-fashion-diploma"

# 4. Create a course → module
export PROG=$(curl -sS http://localhost:4000/v1/programs \
  -H "authorization: Bearer $AT" | jq -r '.data.items[0].id')
export COURSE=$(curl -sS -X POST http://localhost:4000/v1/courses \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d "{\"programId\":\"$PROG\",\"name\":\"Airport Ground Ops\",\"slug\":\"airport-ground-ops\"}" \
  | jq -r .data.course.id)
curl -sS -X POST "http://localhost:4000/v1/courses/$COURSE/modules" \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"title":"Welcome","order":0,"content":[{"kind":"text","title":"Intro","textMarkdown":"# Hi"}]}'
curl -sS -X POST "http://localhost:4000/v1/courses/$COURSE/publish" \
  -H "authorization: Bearer $AT" | jq .data.course.publishedVersion
# → 1

# 5. Create a batch and enrol a student
export BATCH=$(curl -sS -X POST http://localhost:4000/v1/batches \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d "{\"programId\":\"$PROG\",\"name\":\"Aviation Batch 1 — July 2026\",\"startDate\":\"2026-07-01T00:00:00Z\",\"endDate\":\"2026-12-31T00:00:00Z\"}" \
  | jq -r .data.batch.id)
# (Create a student via M2 user-admin flow; accept invite to get AT_STU + STU id)
curl -sS -X POST http://localhost:4000/v1/enrollments \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d "{\"studentId\":\"$STU\",\"programId\":\"$PROG\",\"batchId\":\"$BATCH\",\"validFrom\":\"2026-07-01T00:00:00Z\",\"validTo\":\"2027-07-01T00:00:00Z\"}"
# → 201 { data: { enrolments: [...], count: 1 } }

# 6. Student dashboard + module view (writes module.viewed audit)
curl -sS http://localhost:4000/v1/students/me/dashboard -H "authorization: Bearer $AT_STU" | jq
curl -sS http://localhost:4000/v1/modules/$MOD -H "authorization: Bearer $AT_STU"

# 7. Simulate fee suspension → student gets 403 SUSPENDED_ACCESS
# (mongosh) db.enrollments.updateOne({_id: ObjectId('...')}, { $set: { accessState: 'suspended' } })
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/modules/$MOD -H "authorization: Bearer $AT_STU"
# → 403
```

## Open items / known gaps for later milestones

- **Q-M3-01**: Enrollment `courseVersion` pointer for unpublish rollback. Deferred (D-030). Revisit with Logan before M8.
- **Q-M3-02**: Batch status state-machine transitions not spec'd. Admin PATCH accepts any status.
- **Q-M3-03**: Module soft-delete policy when `module.viewed` rows exist — M6 audit UI should surface tombstoned modules.
- `CloudinaryStorageAdapter` is a class stub that throws; actual SDK wiring scheduled for M5 receipts per D-027.
- `certificateTemplateId` field on Course accepted but unused until M8.
- Web UI for every M3 surface deferred to M4+ (scoped API-only per the M3 prompt).

## For the next session (M4 — Timetable)

- **Faculty ↔ Timetable validation**: `TimetableEntry.facultyId` should be validated against `Course.facultyIds` (D-024). Reuse `facultyAssignedToCourse(course, userId)` from [api/src/services/courseService.ts](../../api/src/services/courseService.ts).
- **Batch coordinators** (`Batch.coordinators`, not `Course.facultyIds`) are per-batch faculty overseers. M4 may want an overlap check with timetable entries.
- **Enrollment.validTo** powers the M5 cron that flips `status='active'` → `'expired'`; the flip is already done inline in `moduleAccessService` step 5 for cache-consistency.
- **StudentDashboard stubs** (`nextClass`, `outstandingFees`, `openTickets`, `newFeedback`) fill in M4 / M5 / M6 / M7 respectively. Keep the `{stub: true, ...}` envelope shape — M4+ UI is already reading it.
- **`module.viewed` audit rows** accumulate rapidly; the M6 audit UI should probably paginate and/or filter this action. No retention policy yet.
- **Course.publishedVersion** increments on publish but never decrements on unpublish (D-030). Unpublish → re-publish = `publishedVersion + 1`.

## Surprises during M3

1. **`sparse: true` doesn't skip explicit null values** (D-034). M2 tests got lucky creating at most one null-code user per case; M3's richer scenes tripped `E11000 { code: null }` on admin+student in the same test. Fixed with `partialFilterExpression: { code: { $type: 'string' } }`.
2. **`Buffer` isn't in shared-types' tsconfig scope** — shared-types has no `@types/node`. Changed `StorageUploadInput.buffer: Buffer` → `bytes: Uint8Array` so the package stays browser-safe; Node `Buffer extends Uint8Array` so api-side code is unaffected.
3. **Two-step access gate test anti-pattern** — calling `assertStudentCanViewModule` twice in one test mutates state (flips `status='expired'`), so the second call throws a different error. Replaced with a single try/catch + follow-up DB read.
4. **Module model naming** — Node's built-in `Module` shadowed the Mongoose model. Exported as `ModuleModel` from [api/src/models/module.ts](../../api/src/models/module.ts).
5. **`POST /v1/enrollments` creates N rows, not one** — "enrol student in program + batch" fans out to all courses in the program. Response shape is `{enrolments: [...], count: N}`, not `{enrolment: {...}}`.
