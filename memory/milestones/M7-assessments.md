# M7 — Assessments + Rubric Feedback

**Date completed:** 2026-04-22
**Supersedes:** — (extends M2 auth + audit, M3 Course/Module/Enrolment + facultyIds, M5 clockService + cron infra, M6 notificationService pattern)
**Test result:** 69 files / 365 tests green · services coverage 81.05% lines / 65.59% branches / 90.35% functions (gates 70/55/70 — all pass). One in-branch security-review finding resolved before commit (D-068).

## What was built

Full server-side assessment + feedback surface. Faculty create module quizzes (MCQ only) and course final exams (MCQ + essay), students attempt within open/close windows with per-quiz attempt limits, faculty grade essays via a per-question rubric, feedback flows one-way from faculty → student with email + in-app notification, and completion detection publishes a persisted `course.completed` domain event that M8 will consume for Certifier.io issuance. A signed Monday 09:00 IST cron compiles the faculty weekly digest (ungraded essays + stale drafts >7 days).

### Models (7 new, under [api/src/models/](../../api/src/models/))

- **`Quiz`** — per TRD §4.9. Module-scoped MCQ only: `moduleId`, `title`, `durationMinutes?`, `maxAttempts` (default 3), `passingPercent` (default 60), `questions[]` (`text`, `kind: 'mcq_single' | 'mcq_multi'`, `options[]`, `correctIndices[]`, `points`), `state: 'draft' | 'scheduled' | 'live' | 'closed'`, `openAt?`, `closeAt?`. Index `{moduleId, state}`.
- **`QuizAttempt`** — `quizId`, `studentId`, `startedAt`, `submittedAt?`, `answers[]` (`questionIndex`, `chosenIndices[]`), `scorePercent?`, `passed?`. Indexes `{quizId, studentId}`, `{studentId, submittedAt}`.
- **`Exam`** — per TRD §4.9. Course-scoped mixed: `courseId`, `title`, `durationMinutes` (default 120), `maxAttempts` (default 1), `passingPercent` (default 50), `questions[]` (same as Quiz + `kind` extends to `'essay'` + optional `rubricId`, `wordLimit`). Index `{courseId, state}`.
- **`ExamAttempt`** — quiz fields + `essayAnswers[]` (`questionIndex`, `text`), `mcqScorePercent?`, `essayScorePercent?`, `totalScorePercent?`, `passed?`, `grades[]` (per-essay score + comment + rubric scores), `graderUserId?`, `gradedAt?`. Grading queue index `{essayScorePercent, submittedAt}`.
- **`Rubric`** — per TRD §4.8. `courseId`, `name`, `criteria[]` (`label`, `kind: 'numeric' | 'scale'`, `maxScore?`, `scale[]`), `isTemplate`.
- **`FeedbackEntry`** — per TRD §4.8. `studentId`, `courseId`, `moduleId?`, `facultyId`, `level: 'assignment' | 'module' | 'assessment'`, `assessmentRef?` (ObjectId, untyped ref — can point at QuizAttempt or ExamAttempt), `rubricId?`, `scores[]` (`criterionIndex`, `score?`, `label?`), `comments`, `summary`, `status: 'draft' | 'published'`, `publishedAt?`. Indexes for student inbox, faculty queue, and coverage.
- **`DomainEvent`** — net-new plumbing (D-062). `type`, `payload`, `publishedAt`, `consumedAt?`, `consumerError?`. Only `course.completed` defined for now; M8 will register listeners.

### Shared types ([packages/shared-types/src/](../../packages/shared-types/src/))

- `enums.ts` — `QUIZ_STATES`, `QUIZ_QUESTION_KINDS`, `EXAM_QUESTION_KINDS`, `RUBRIC_CRITERION_KINDS`, `FEEDBACK_LEVELS`, `FEEDBACK_STATUSES`, `DOMAIN_EVENT_TYPES`. `NOTIFICATION_TYPES` +2 (`assessment.graded`, `feedback.published`). `AUDIT_ACTIONS` +19.
- `dto/assessments.ts` (new) — `QuizDto`, `StudentQuizDto` (strips correctIndices), `QuizAttemptDto`, `ExamDto`, `StudentExamDto`, `ExamAttemptDto`, `CreateQuizInput`, `UpdateQuizInput`, `SubmitQuizAttemptInput`, `CreateExamInput`, `UpdateExamInput`, `SubmitExamAttemptInput`, `GradeExamAttemptInput`, `ExamAttemptGradeInput`, `ExamAttemptGradeRubricScore`, `ExamGradingQueueQuery`.
- `dto/feedback.ts` (new) — `RubricDto`, `RubricCriterionDto`, `CreateRubricInput`, `UpdateRubricInput`, `FeedbackEntryDto`, `FeedbackScoreDto`, `CreateFeedbackInput`, `UpdateFeedbackInput`, `FeedbackListQuery`, `FacultyDigestJobResult`.
- `index.ts` — re-exports both new DTO files.

### Services (under [api/src/services/](../../api/src/services/))

- **`assessmentScoring`** ([.../assessmentScoring.ts](../../api/src/services/assessmentScoring.ts)) — pure math. `gradeMcqAnswers` does all-or-nothing per question (D-060): `mcq_single` requires exactly one match, `mcq_multi` requires set equality. `computeEssayTotals` sums graded essay points + flags `allEssaysGraded`. `computeTotalPercent` blends MCQ + essay over combined total (defensive 100% on zero total).
- **`authzService`** ([.../authzService.ts](../../api/src/services/authzService.ts)) — `assertFacultyOwnsCourse(userId, role, courseId)` (admin/superadmin bypass, faculty must appear in `Course.facultyIds` — shipped in M3 D-024). `assertStudentEnrolledInCourse` for quiz/exam gate.
- **`domainEventService`** ([.../domainEventService.ts](../../api/src/services/domainEventService.ts)) — `publishDomainEvent(type, payload)` persists a `DomainEvent` row and invokes any in-process listeners registered via `registerListener(type, fn)`. Listener failures are logged but never fail the publisher. `markConsumed(eventId)` for future consumers.
- **`courseCompletionService`** ([.../courseCompletionService.ts](../../api/src/services/courseCompletionService.ts)) — `checkAndMaybePublish(enrolmentId)`: if every Quiz in every Module of the course has a passing QuizAttempt AND at least one passing ExamAttempt for the course exists, sets `Enrolment.completed = true` + `completedAt = now`, audits `enrollment.completed`, and publishes `course.completed`. Idempotent via the `completed` flag short-circuit. `checkAllActiveEnrolmentsForStudentCourse` wraps for the submit/grade flows.
- **`quizService`** ([.../quizService.ts](../../api/src/services/quizService.ts)) — CRUD (admin/faculty own-course only), `getQuizForStaff`/`getQuizForStudent`, `startAttempt` (enforces `maxAttempts`, `openAt/closeAt`, `state==='live'`, resumes an in-progress attempt), `submitAttempt` (auto-grades MCQ, flips `scorePercent` + `passed`, triggers completion check on pass), `listAttemptsForStudent`. Emits `quiz.created`/`quiz.updated`/`quiz.state_changed`/`quiz.attempt.started`/`quiz.attempt.submitted` audits.
- **`examService`** ([.../examService.ts](../../api/src/services/examService.ts)) — mirrors quizService for course-level exams. `submitExamAttempt` auto-grades MCQs only; essay portion stays pending until faculty grades. DTOs: `toExamDto` (staff, full), `toStudentExamDto` (essay options stripped, correctIndices removed — D-067).
- **`gradingService`** ([.../gradingService.ts](../../api/src/services/gradingService.ts)) — `gradeExamAttempt(actor, attemptId, {grades}, ctx)` rejects if attempt un-submitted, enforces faculty-course ownership, validates each grade targets an essay question + rubricScores length matches the referenced Rubric's criteria count. Replaces (not merges) the `grades[]` array (D-064) for idempotent re-grading, recomputes mcqScorePercent from current answers, essayScorePercent from graded essays, totalScorePercent when all essays graded, passes `assessment.graded` notification to the student, and invokes the completion check on pass. `listGradingQueueForFaculty` returns submitted-but-ungraded attempts filtered by faculty ownership.
- **`rubricService`** ([.../rubricService.ts](../../api/src/services/rubricService.ts)) — CRUD with the faculty-own-course gate; validates numeric criteria have `maxScore>=1`, scale criteria have ≥2 labels. `listRubrics` for faculty scopes to owned courses (dynamic Course import keeps the import graph cycle-free).
- **`feedbackService`** ([.../feedbackService.ts](../../api/src/services/feedbackService.ts)) — `createFeedback` (level-shape guards: assignment/module require moduleId, assessment requires assessmentRef), `updateFeedback` (blocks published→draft revert, D-065), `publishFeedback` (one-shot: set `publishedAt`, audit, enqueue `feedback.published` email + in-app), `listFeedback` (faculty scoped to own rows, student forbidden — use `/me/feedback`), `listForStudent` (published only, newest-first), `getFeedback` (student can read only their own published entries). Rubric coherence validated on create + update (scores length must equal criteria length).
- **`facultyDigestService`** ([.../facultyDigestService.ts](../../api/src/services/facultyDigestService.ts)) — `buildFacultyDigestBuckets(now)` unions ungraded essays (ExamAttempts `submittedAt < now-7d`, `totalScorePercent===null`) with stale feedback drafts (`status='draft'`, `createdAt < now-7d`), groups by faculty via `Course.facultyIds` / `FeedbackEntry.facultyId`, resolves name + email. `runFacultyDigest` renders an email body per faculty (courseId → item list with kind + daysOld), sends via the Resend adapter (`tag: 'faculty.weekly_digest'`), returns `{processed, facultyCount, totalPendingItems, emailsSent, emailErrors}`.
- **`notificationService`** (extended) — `CHANNELS_BY_TYPE` +2: `assessment.graded` and `feedback.published`, both `['inapp', 'email']`. No WhatsApp (Q-M7-02).

### Routes (under [api/src/routes/](../../api/src/routes/))

- **`quizzes.ts`** — `POST /v1/quizzes` + `PATCH /v1/quizzes/:id` (admin/superadmin/faculty) + `GET /v1/quizzes/:id` (role-branched: student sees `StudentQuizDto` + own attempts; staff sees full `QuizDto`). `POST /v1/quizzes/:id/attempt` (student only). Exports a second `quizAttemptsRouter` for `POST /v1/quiz-attempts/:id/submit` (student only).
- **`exams.ts`** — mirrors quizzes. `GET /v1/exam-attempts` (grading queue, faculty/admin only). `PATCH /v1/exam-attempts/:id/grade` (faculty-own-course).
- **`rubrics.ts`** — full CRUD + list. Faculty-only for owned courses; admin/superadmin bypass.
- **`feedback.ts`** — `GET/POST/PATCH /v1/feedback`, `GET /v1/feedback/:id`, `POST /v1/feedback/:id/publish`. Exports `meFeedbackRouter` for `GET /v1/me/feedback` (student-only).
- **`jobsFacultyDigest.ts`** — `POST /v1/jobs/digest-faculty-weekly`, `requireJobAuth`.
- **`routes/index.ts`** — jobsFacultyDigest mounts under `/jobs` alongside jobsFees/jobsSla (before auth). `/quizzes`, `/quiz-attempts`, `/exams`, `/exam-attempts`, `/rubrics` mount normally; `/me/feedback` mounts BEFORE `/feedback` so the literal `/me` segment wins (D-066).

### Jobs

- **`api/src/jobs/facultyDigestJob.ts`** — wraps `runFacultyDigest()`, records `jobs.faculty_digest.invoked` audit with `{processed, facultyCount, totalPendingItems, emailsSent, emailErrors}`.

### Test factories ([api/tests/helpers/factories.ts](../../api/tests/helpers/factories.ts))

- `makeQuiz`, `makeQuizAttempt`, `makeExam`, `makeExamAttempt`, `makeRubric`, `makeFeedback`. The `makeFeedback` factory supports overriding `createdAt` via a raw `collection.updateOne` (Mongoose `timestamps: true` re-bumps `createdAt` on every `.save()`) — needed for digest-threshold fixtures.

### Tests (+48 new, 364/364 total)

**Unit (5 new files, 27 new tests):**
- `assessmentScoring.test.ts` (11) — single match happy, multi set-equality happy, "tie" partial multi → 0, superset-with-correct-included → 0, skip-all → 0, out-of-range indices ignored, single-multi-pick → 0, exam question mix (essay skipped in MCQ totals), essay totals math (earned/total + all-graded flag, missing grade), totalPercent blend + zero-total defense.
- `gradingService.test.ts` (5) — happy path recompute + student notification, faculty-not-owner 403, re-grade idempotency (rewrites grades[]), un-submitted attempt rejected, rubric length mismatch 422.
- `feedbackService.test.ts` (4) — rubric length mismatch 422, draft → publish sets publishedAt + enqueues notification, published cannot revert to draft, missing moduleId on level='module' 422.
- `courseCompletionService.test.ts` (3) — no-exam blocks completion, unpassed quiz blocks, all-passed fires once + idempotent on re-check + DomainEvent row persisted.
- `facultyDigestService.test.ts` (4) — ungraded essay >7d included, recent excluded, multi-faculty grouping, stale draft feedback included, `runFacultyDigest` sends via spy email adapter with `tag: 'faculty.weekly_digest'`.

**Integration (5 new files, 21 new tests):**
- `quizzes.crud.test.ts` (6) — faculty creates + publishes + student attempts + passes, "tie" multi-select under passingPercent fails, `ASSESSMENT_ATTEMPTS_EXHAUSTED` on N+1 attempt, `ASSESSMENT_NOT_LIVE` on draft quiz for student, unenrolled student 403, faculty-not-owner 403 on create.
- `exams.grade.test.ts` (4) — student submit leaves essay pending, faculty grade → totalScorePercent + student notification, other faculty 403 on grade, grading queue excludes graded attempts.
- `feedback.test.ts` (5) — rubric-backed create+publish, rubric length mismatch 422, `/me/feedback` returns published only newest-first (drafts hidden), cross-student 403 on feedback detail, student POST 403.
- `rubrics.crud.test.ts` (4) — faculty CRUD + list on own course, other-faculty 403 on create, scale <2 labels 422, student 403 on list.
- `jobs.facultyDigest.test.ts` (2) — unsigned 401, signed request runs + returns `{facultyCount, emailsSent}`.

Coverage services/ aggregate: 81.05% lines / 65.59% branches / 90.35% functions — gates (70/55/70) pass. Notable per-file: `assessmentScoring.ts` 100% lines, `courseCompletionService.ts` 85% lines, `gradingService.ts` 85.92% lines. `examService.ts` dips to 43.9% lines because some list/start paths share coverage with route-level integration tests rather than a dedicated unit suite — low risk given route-level coverage is solid.

## Files changed / added

**New (20)**:
- Models: `api/src/models/{quiz, quizAttempt, exam, examAttempt, rubric, feedbackEntry, domainEvent}.ts`
- Services: `api/src/services/{assessmentScoring, authzService, domainEventService, courseCompletionService, quizService, examService, gradingService, rubricService, feedbackService, facultyDigestService}.ts`
- Jobs: `api/src/jobs/facultyDigestJob.ts`
- Routes: `api/src/routes/{quizzes, exams, rubrics, feedback, jobsFacultyDigest}.ts`
- Shared types: `packages/shared-types/src/dto/{assessments, feedback}.ts`
- Smoke doc: `docs/smoke/m7-assessments.md`
- Tests: 5 unit + 5 integration (see above)

**Modified (6)**:
- `api/src/models/{index, notification}.ts` — re-exports + enum +2.
- `api/src/routes/index.ts` — jobsFacultyDigest + 7 M7 routers mounted; `/me/feedback` before `/feedback` (D-066).
- `api/src/services/notificationService.ts` — CHANNELS_BY_TYPE +2.
- `packages/shared-types/src/{enums, index}.ts` — 7 M7 enum families, +2 notification types, +19 audit actions, DTO re-exports.
- `api/tests/helpers/factories.ts` — 6 M7 factories.

## API surface mounted

- `POST /v1/quizzes`, `GET /v1/quizzes/:id`, `PATCH /v1/quizzes/:id`
- `POST /v1/quizzes/:id/attempt`, `POST /v1/quiz-attempts/:id/submit`
- `POST /v1/exams`, `GET /v1/exams/:id`, `PATCH /v1/exams/:id`
- `POST /v1/exams/:id/attempt`, `POST /v1/exam-attempts/:id/submit`
- `GET /v1/exam-attempts` (grading queue), `PATCH /v1/exam-attempts/:id/grade`
- `GET /v1/rubrics`, `POST /v1/rubrics`, `GET /v1/rubrics/:id`, `PATCH /v1/rubrics/:id`, `DELETE /v1/rubrics/:id`
- `GET /v1/feedback`, `POST /v1/feedback`, `GET /v1/feedback/:id`, `PATCH /v1/feedback/:id`, `POST /v1/feedback/:id/publish`
- `GET /v1/me/feedback`
- `POST /v1/jobs/digest-faculty-weekly` (HMAC-signed)

Success envelope `{data: ...}`; errors `{error: {code, message, details?}}`.

## Drift from the M7 prompt (resolved per spec)

Captured in plan alignment. Final implementation per CLAUDE.md §2 spec hierarchy:
- Endpoint paths follow TRD §7.7: `/v1/quizzes/:id/attempt` (start) + `/v1/quiz-attempts/:id/submit`, not `/start` from the original prompt.
- MCQ multi-correct grading is **all-or-nothing** per question (D-060, Vidit-confirmed). "Tie" test case = partial match → 0.
- Course completion predicate drops the unenforceable "all Modules' content opened" clause (D-061, Vidit-confirmed, flagged Q-M7-01).
- `course.completed` event flows through a minimal `DomainEvent` collection + in-process listener registry (D-062) rather than a queue.
- Faculty weekly digest scope = ungraded essays + stale drafts >7d, grouped per faculty (D-063, pending Logan ratification via Q-M7-03).
- Grading replaces `grades[]` (D-064), not merges; supports regrade.
- Published feedback cannot revert to draft (D-065).
- `/me/feedback` mounts before `/feedback` (D-066).
- Student quiz/exam DTOs strip `correctIndices` and essay options (D-067).
- **Security review fix:** `GET /v1/feedback/:id` now carries `requireRole('student','faculty','admin','superadmin')` and `getFeedback` has an explicit default-deny for unexpected roles (D-068). Regression test in [api/tests/integration/feedback.test.ts](../../api/tests/integration/feedback.test.ts) asserts `finance` gets 403 on both draft and published entries.

## Open items / known gaps for later milestones

- **Q-M7-01** (Logan) — Ratify the completion predicate (drop "content opened"). Medium impact: shapes when `course.completed` fires in M8.
- **Q-M7-02** (LUC ops) — Assessment/feedback WhatsApp templates not approved. M7 ships email + in-app only.
- **Q-M7-03** (Logan) — Digest scope confirmation (ungraded essays + stale drafts bundled).
- **Q-M7-04** (Logan) — Whether to add a `'graded'` terminal quiz/exam state.
- **Q-M7-05** (Vidit, carried from M6) — `payments.record.test.ts` test-ordering flake. Intermittent, not a regression.

## For the next session (M8 — Certificates + notification engine + analytics)

- **Register a `course.completed` listener.** M7 persists the event + invokes any in-process listeners. M8 will `registerListener('course.completed', async (payload) => { /* call CertificateService.issue */ })` at app boot. Because the row is already written, a separate sweep cron can retry if the listener errored.
- **Notification template registry.** M7 sends plain-text email + in-app for `assessment.graded` and `feedback.published`. M8's template registry should own the copy + branding. Wire types are already in `NOTIFICATION_TYPES`.
- **Analytics inputs ready.** Coverage queries already implemented (pending FeedbackEntry drafts + ungraded ExamAttempts). The admin analytics dashboard can read directly from `FeedbackEntry`, `ExamAttempt`, `QuizAttempt`, and the `Enrolment.completed` flag without new services.
- **Web UI backlog.** Consistent with M2–M6, the M7 UI (faculty quiz/exam/grading/rubric/feedback screens + student attempt + feedback dashboard) is deferred to the standing UI backlog; the API contract is stable and matches the approved webapp mockups' data requirements.

## Surprises during M7

1. **Mongoose `timestamps: true` re-bumps `createdAt` on every `save()`.** `makeFeedback({createdAt: oldDate})` initially set the date via `doc.set('createdAt', old); await doc.save()` but the save path overwrote it. Fix: raw `FeedbackEntry.collection.updateOne({_id}, {$set: {createdAt}})` bypasses the timestamps middleware.
2. **Zod `.nullable().optional()` produces `T | null | undefined`, but DTOs use `T | null`.** Type mismatches on the three exam routes (create, update, grade) forced an explicit normalization layer in the route handler: `rubricScores?.map(r => ({...r, score: r.score ?? null, label: r.label ?? null}))`. Same pattern for rubric/feedback. Worth adding a shared helper if M8 adds more.
3. **Dynamic `import('../models/course.js')` inside `rubricService.listRubrics`.** Introduced to avoid a static import cycle (rubric → course model → course service → ... ). Works but feels like a code smell; simpler would be to lift the `facultyIds` lookup into `authzService`.
4. **Exam `toStudentExamDto` must also strip essay `options`.** Essay questions on the Mongo side can have empty `options[]`, but an admin might mistakenly populate them. The student DTO defensively returns `[]` for essay `kind`. No security risk today but a guard worth having.
5. **Completion check triggered on quiz `passed=true` AND on exam grade `passed=true`.** The quiz path was easy to forget — a student could pass the last quiz after the exam was already graded and never trip completion. Fixed by calling `checkAllActiveEnrolmentsForStudentCourse` from `quizService.submitAttempt` on pass.
6. **Full-suite vs isolated test-run discrepancy.** The `payments.record.test.ts` 404 flake surfaced again in one of two back-to-back full runs (green on the second). Not an M7 regression — carried as Q-M7-05.
