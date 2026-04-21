# M7 — Assessments + Rubric Feedback: manual smoke

Walks through the full quiz + exam + feedback + digest flow with curl. Assumes the API is running at `http://localhost:4000` and the seed has been applied (one admin, one faculty, one student enrolled in a published course with at least one module).

All requests use JSON bodies. Run with `-sS` to keep output quiet on success.

## 0. Auth tokens

```bash
FACULTY_AT=$(curl -sS -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"faculty@example.com","password":"Faculty#12345"}' \
  | jq -r .data.accessToken)

STUDENT_AT=$(curl -sS -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"student@example.com","password":"Student#12345"}' \
  | jq -r .data.accessToken)

# Grab a known moduleId and courseId from the student's dashboard.
MODULE_ID=$(curl -sS http://localhost:4000/v1/me/courses \
  -H "authorization: Bearer $STUDENT_AT" | jq -r '.data.courses[0].modules[0].id')
COURSE_ID=$(curl -sS http://localhost:4000/v1/me/courses \
  -H "authorization: Bearer $STUDENT_AT" | jq -r '.data.courses[0].id')
```

## 1. Faculty creates a quiz

```bash
QUIZ_ID=$(curl -sS -X POST http://localhost:4000/v1/quizzes \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d @- <<JSON | jq -r .data.quiz.id
{
  "moduleId": "$MODULE_ID",
  "title": "Module 1 Check-in",
  "passingPercent": 60,
  "maxAttempts": 2,
  "questions": [
    {"text":"2 + 2 = ?","kind":"mcq_single","options":["3","4","5"],"correctIndices":[1],"points":2},
    {"text":"Primes under 10","kind":"mcq_multi","options":["2","3","4","5"],"correctIndices":[0,1,3],"points":3}
  ]
}
JSON

curl -sS -X PATCH http://localhost:4000/v1/quizzes/$QUIZ_ID \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d '{"state":"live"}' | jq .data.quiz.state  # → "live"
```

## 2. Student attempts the quiz — partial multi first (fails), then full (passes)

```bash
# Attempt 1: partial multi → 2/5 = 40% → fail
ATTEMPT_ID=$(curl -sS -X POST http://localhost:4000/v1/quizzes/$QUIZ_ID/attempt \
  -H "authorization: Bearer $STUDENT_AT" | jq -r .data.attempt.id)
curl -sS -X POST http://localhost:4000/v1/quiz-attempts/$ATTEMPT_ID/submit \
  -H "authorization: Bearer $STUDENT_AT" -H 'content-type: application/json' \
  -d '{"answers":[{"questionIndex":0,"chosenIndices":[1]},{"questionIndex":1,"chosenIndices":[0,1]}]}' \
  | jq '.data.attempt | {scorePercent, passed}'
# → { "scorePercent": 40, "passed": false }

# Attempt 2: all correct → 100% pass
ATTEMPT2=$(curl -sS -X POST http://localhost:4000/v1/quizzes/$QUIZ_ID/attempt \
  -H "authorization: Bearer $STUDENT_AT" | jq -r .data.attempt.id)
curl -sS -X POST http://localhost:4000/v1/quiz-attempts/$ATTEMPT2/submit \
  -H "authorization: Bearer $STUDENT_AT" -H 'content-type: application/json' \
  -d '{"answers":[{"questionIndex":0,"chosenIndices":[1]},{"questionIndex":1,"chosenIndices":[0,1,3]}]}' \
  | jq '.data.attempt | {scorePercent, passed}'
# → { "scorePercent": 100, "passed": true }

# Third attempt should 409 — maxAttempts=2.
curl -sS -X POST http://localhost:4000/v1/quizzes/$QUIZ_ID/attempt \
  -H "authorization: Bearer $STUDENT_AT" -w '\n%{http_code}\n'
# → ASSESSMENT_ATTEMPTS_EXHAUSTED 409
```

## 3. Final exam — mixed MCQ + essay

```bash
EXAM_ID=$(curl -sS -X POST http://localhost:4000/v1/exams \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d @- <<JSON | jq -r .data.exam.id
{
  "courseId": "$COURSE_ID",
  "title": "Final Exam",
  "durationMinutes": 120,
  "passingPercent": 50,
  "questions": [
    {"text":"Capital of India?","kind":"mcq_single","options":["Mumbai","New Delhi","Chennai"],"correctIndices":[1],"points":4},
    {"text":"Describe ATC handover","kind":"essay","options":[],"correctIndices":[],"points":6,"wordLimit":300}
  ]
}
JSON

curl -sS -X PATCH http://localhost:4000/v1/exams/$EXAM_ID \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d '{"state":"live"}' | jq .data.exam.state
```

## 4. Student submits the exam

```bash
EA_ID=$(curl -sS -X POST http://localhost:4000/v1/exams/$EXAM_ID/attempt \
  -H "authorization: Bearer $STUDENT_AT" | jq -r .data.attempt.id)
curl -sS -X POST http://localhost:4000/v1/exam-attempts/$EA_ID/submit \
  -H "authorization: Bearer $STUDENT_AT" -H 'content-type: application/json' \
  -d '{"answers":[{"questionIndex":0,"chosenIndices":[1]}],"essayAnswers":[{"questionIndex":1,"text":"The handover briefing is…"}]}' \
  | jq '.data.attempt | {mcqScorePercent, totalScorePercent, passed}'
# → { mcqScorePercent: 100, totalScorePercent: null, passed: null }
```

## 5. Faculty grades the essay via the grading queue

```bash
curl -sS http://localhost:4000/v1/exam-attempts \
  -H "authorization: Bearer $FACULTY_AT" \
  | jq '.data.attempts | map({id, examId, submittedAt, mcqScorePercent})'

curl -sS -X PATCH http://localhost:4000/v1/exam-attempts/$EA_ID/grade \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d '{"grades":[{"questionIndex":1,"score":5,"comment":"Good structure, tighten section 2."}]}' \
  | jq '.data.attempt | {totalScorePercent, passed, gradedAt}'
# → totalScorePercent: 90, passed: true
```

The student receives an `assessment.graded` in-app + email notification at this point. Confirm via `GET /v1/notifications/me`.

## 6. Rubric + Feedback

```bash
RUBRIC_ID=$(curl -sS -X POST http://localhost:4000/v1/rubrics \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d @- <<JSON | jq -r .data.rubric.id
{
  "courseId": "$COURSE_ID",
  "name": "Essay Rubric",
  "criteria": [
    {"label":"Clarity","kind":"numeric","maxScore":5},
    {"label":"Depth","kind":"scale","scale":["Developing","Competent","Proficient","Exemplary"]}
  ]
}
JSON

STUDENT_ID=$(curl -sS http://localhost:4000/v1/users/me \
  -H "authorization: Bearer $STUDENT_AT" | jq -r .data.user.id)

FB_ID=$(curl -sS -X POST http://localhost:4000/v1/feedback \
  -H "authorization: Bearer $FACULTY_AT" -H 'content-type: application/json' \
  -d @- <<JSON | jq -r .data.feedback.id
{
  "studentId": "$STUDENT_ID",
  "courseId": "$COURSE_ID",
  "level": "assessment",
  "assessmentRef": "$EA_ID",
  "rubricId": "$RUBRIC_ID",
  "scores": [{"criterionIndex":0,"score":4},{"criterionIndex":1,"label":"Proficient"}],
  "comments": "Strong argumentation throughout.",
  "summary": "Well done — above expectations on the exam essay."
}
JSON

curl -sS -X POST http://localhost:4000/v1/feedback/$FB_ID/publish \
  -H "authorization: Bearer $FACULTY_AT" \
  | jq '.data.feedback | {status, publishedAt}'
```

## 7. Student reads their feedback

```bash
curl -sS http://localhost:4000/v1/me/feedback \
  -H "authorization: Bearer $STUDENT_AT" \
  | jq '.data.feedback | map({summary, level, publishedAt})'
```

## 8. Course completion event

After step 5 passes the final exam **and** all quizzes for the course have at least one passing attempt, a `course.completed` DomainEvent is published. M8 will consume it for Certifier.io issuance — for M7 we just verify the event row exists:

```bash
# Requires mongo shell or direct DB access (no public API yet).
mongosh "$MONGODB_URI" --eval 'db.domainevents.find({type:"course.completed"}, {payload:1, publishedAt:1}).limit(5).pretty()'
```

The enrolment document should also have `completed: true, completedAt: <ts>`.

## 9. Faculty weekly digest cron (manual invocation)

```bash
BODY='{}'
TS=$(date +%s)
SIG=$(node -e 'const c=require("crypto");process.stdout.write(c.createHmac("sha256",process.env.JOB_SECRET).update("{}"+process.argv[1]).digest("hex"))' "$TS")
curl -sS -X POST http://localhost:4000/v1/jobs/digest-faculty-weekly \
  -H "x-job-signature: $SIG" \
  -H "x-job-timestamp: $TS" \
  -H 'content-type: application/json' \
  -d "$BODY" | jq .
```

Expected response:

```json
{ "data": { "processed": N, "facultyCount": N, "totalPendingItems": M, "emailsSent": N, "emailErrors": 0 } }
```

An audit row `jobs.faculty_digest.invoked` is written.

## Happy-path test matrix covered in CI

| Flow | Test file |
|------|-----------|
| MCQ single + multi + skip-all scoring | `tests/unit/assessmentScoring.test.ts` |
| Student attempt window guards | `tests/integration/quizzes.crud.test.ts` |
| Essay grading recompute | `tests/unit/gradingService.test.ts` |
| Faculty course-ownership (403) | `tests/integration/exams.grade.test.ts`, `tests/integration/rubrics.crud.test.ts` |
| Rubric length validation | `tests/unit/gradingService.test.ts`, `tests/integration/feedback.test.ts` |
| Draft → publish notification | `tests/unit/feedbackService.test.ts` |
| Student-only `/me/feedback` ACL | `tests/integration/feedback.test.ts` |
| Completion predicate + event | `tests/unit/courseCompletionService.test.ts` |
| Digest selection + email | `tests/unit/facultyDigestService.test.ts`, `tests/integration/jobs.facultyDigest.test.ts` |
