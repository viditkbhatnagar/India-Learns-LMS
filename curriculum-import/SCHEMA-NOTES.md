# Curriculum Generator → India Learns LMS — Schema Notes

Companion to `sample-workflow-full.json` (5.7MB raw) and `sample-workflow-slim.json` (500KB, structurally complete with arrays trimmed).

Both files are the actual response from a real completed workflow on the live generator. Use these to write the Zod validator, not the PDF spec — the PDF has a few field-name mistakes.

---

## API basics

- **Base URL:** `https://curriculum-api-bsac.onrender.com`
- **Health:** `GET /health` (no auth)
- **Workflow read:** `GET /api/v3/workflow/:id` (no auth — confirmed at `routes/workflowRoutes.ts:215`)
- **Mutation endpoints:** `POST/PUT` paths use Auth0 JWT via `validateJWT` middleware. Read endpoints don't.
- **Response envelope:** every response is wrapped in `{ success: true, data: <payload> }`. Don't drop `.data`.
- **Cold start:** Render free tier spins down after ~15 min idle. First request can take 30s.
- **Sample workflow ID for testing:** `69bbf3cd5c4093e441e75eba` (project: "Maths Certification", `currentStep: 13`, `status: "review_pending"`).

## Top-level workflow shape

```ts
{
  _id: string,                    // Mongo ObjectId
  projectName: string,            // NOT programTitle at the root
  createdBy: string,              // user id
  currentStep: 1..13,
  status: "review_pending" | "step10_pending" | "step10_complete" | ... | "step13_complete" | "completed",
  stepProgress: Array<{ step, status, completedAt }>,
  step1, step2, ..., step13,      // sub-documents, see below
  createdAt, updatedAt
}
```

Status enum lifted from `CurriculumWorkflow.ts:1155-1162`.

## Step-by-step (corrections to the PDF marked **!**)

### step1 — Program Foundation
Keys: `programTitle, programDescription, programPurpose, programAims, academicLevel, creditFramework, delivery, targetLearner, entryRequirements, careerPathways, jobRoles, executiveSummary, completenessScore, validatedAt`.

> Heads-up: in this real workflow several `step1` fields are `null` because the user filled them in elsewhere. Don't assume populated.

### step2 — KSA (Knowledge / Skills / Attitudes)
Keys: `knowledgeItems[], skillItems[], attitudeItems[], competencyItems[], totalItems, essentialCount, benchmarkPrograms, benchmarkingReport, industryFrameworks, institutionalFrameworks, validatedAt`.

### step3 — Program Learning Outcomes (PLOs)
- **!** PDF called this `step3.plos[]`. Actual: **`step3.outcomes[]`**.
- Each outcome: `{ id, code, outcomeNumber, statement, verb, bloomLevel, linkedKSCs[], jobTaskMapping, assessable, measurable, assessmentAlignment }`.
- Other keys: `targetCount, bloomLevels, bloomDistribution, outcomeEmphasis, configuration, contextConstraints, coverageReport, preferredVerbs, avoidVerbs, priorityCompetencies, validatedAt`.

### step4 — Course Framework / Modules / MLOs
- `step4.modules[]` (8 modules in sample).
- Module keys: `{ id, code, title, description, phase, sequence, credits, contactHours, selfStudyHours, totalHours, prerequisites[], linkedPLOs[], topics[], mlos[], contactActivities[], independentActivities[] }`.
- **!** PDF wanted `Module.aim` and `Module.coreElective`/`type`. The generator does NOT have these. The closest field is `description` (no `aim`); there is no core/elective marker. **Decision:** map `Module.aim ← module.description`; default `Module.coreElective = 'core'` for all imported modules and let staff edit later.
- **!** PDF called the MLO array `learningOutcomes[]`. Actual: **`mlos[]`**.
- MLO keys: `{ id, code, statement, verb, bloomLevel, linkedPLOs[], competencyLinks[] }`.
- **!** PDF wanted `linkedKSCs[]` on the MLO. Actual: `competencyLinks[]` on MLOs (only PLOs have `linkedKSCs`). Map `ModuleLearningOutcome.linkedKSCs ← mlo.competencyLinks`.

### step5 — Sources
`{ sources[], sourcesByModule, totalSources, agiCompliant, peerReviewedPercent, freeAccessPercent, recentSourcesPercent, complianceIssues, ... }`. Not directly mapped in Phase A; useful for citations.

### step6 — Reading Lists
`{ readings[], moduleReadings, coreCount, supplementaryCount, totalCoreMinutes, ... }`. Maps to `Material` (type=reading) attached at module level if Phase A wants readings.

### step7 — Auto-gradable Assessments
`{ formativeAssessments[], summativeAssessments[], sampleQuestions, lmsPackages, validation }`. The LMS PDF did NOT call out step7 in Phase A scope — leave it for now.

### step8 — Case Studies
`{ caseStudies[], proposals[], selectedProposals, casesByType, moduleCoverage, totalCases, ... }`. Phase A: optionally attach as Materials at module level.

### step9 — Glossary
`{ terms[], acronyms[], moduleTermLists, totalTerms, categories, ... }`. Phase A: out of scope; can be a reference Material later.

### step10 — Lesson Plans (the crown jewel — maps to Sessions)
- `step10.moduleLessonPlans[]` (8 entries — one per module).
- Each: `{ moduleId, moduleCode, moduleTitle, totalLessons, totalContactHours, lessons[], pptDecks }`.
- Each lesson: `{ lessonId, lessonNumber, lessonTitle, duration, bloomLevel, objectives[], linkedMLOs[], linkedPLOs[], activities[], formativeChecks[], materials, independentStudy, instructorNotes }`.
- Activity keys: `{ activityId, sequenceOrder, type, title, description, duration, teachingMethod, instructorActions[], studentActions[], resources[] }`.
- **!** Note: `formativeChecks` may be **empty array on some lessons** even though the workflow reports `formativeChecksIncluded: 116` total. Treat as optional on a per-lesson basis.
- `lesson.materials` is a single object (not an array): `{ caseFiles[], pptDeckRef, readingReferences[] }`.
- Sample numbers: 98 total lessons, 147 contact hours.
- **Mapping:** `Session ← lesson` 1:1. `Session.sourceLessonId ← lesson.lessonId`. `Session.linkedMLOs ← lesson.linkedMLOs`. `Session.activities ← lesson.activities`. `Session.formativeChecks ← lesson.formativeChecks ?? []`. `Session.objectives ← lesson.objectives`.

### step11 — PPT Decks (Materials)
- **!** PDF said `step11.pptDecks`. Actual: **`step11.modulePPTDecks[]`**.
- Each: `{ moduleId, moduleCode, moduleTitle, totalLessons, pptDecks[] }`.
- Each deck: `{ deckId, lessonId, lessonNumber, lessonTitle, deliveryMode, slideCount, slides[], validation, generatedAt }`.
- Each slide: `{ slideNumber, slideType, title, content, speakerNotes }`.
- **Slides are STRUCTURED JSON, not .pptx file references in this workflow.** Sample summary: `totalPPTDecks: 98`, `totalSlides: 1352`, `averageSlidesPerLesson: 14`.
- **Implication for storage:** for Phase A you do NOT need a file-streaming endpoint. Store the slide JSON directly as a `Material` (type=`slides`) attached to the matching `Session` via `lessonId → sourceLessonId`. If staff later want a .pptx, the generator already has `POST /api/v3/ppt/download/module/:workflowId/:moduleIndex` (auth required) that renders and streams a real file via `JSZip`.

### step12 — Assignment Packs
- **!** PDF said `step12.assignmentPacks`. Actual: **`step12.moduleAssignmentPacks[]`**.
- Each: `{ moduleId, moduleTitle, variants }`.
- **!** `variants` is an OBJECT keyed by delivery mode — keys are `self_study`, `hybrid`, `in_person` (NOT "Online/Blended/In-Person" as the PDF suggested).
- Each variant: `{ assignmentId, deliveryVariant, overview, brief, assessedOutcomes[], evidenceRequirements[], rubric, accessibilityOptions, academicIntegrity }`.
- `overview`: `{ title, moduleCode, moduleTitle, assignmentType, weighting, groupOrIndividual, submissionFormat, deliveryVariant }`.
- Sample summary: 24 packs total (8 modules × 3 variants).
- **Mapping:** create `Assignment` per variant, attach to the module. `Assignment.sourceAssignmentPackId ← variant.assignmentId`. The `Assignment` must reference a `Session` (per LMS invariant) — use the module's first lesson session, or create a dedicated "Assessment" session per module. **Decision:** create one synthesized "Assessment" session per module to hold its 3 variant assignments (cleanest). Flag as auto-generated.
- **!** `assignmentId` in this workflow is `"undefined-hybrid"` because the source module's `code` came back undefined at the time of generation. Validate and fall back to `${moduleCode}-${deliveryVariant}` when the prefix is undefined.

### step13 — Summative Exam (single object)
- `step13` keys: `{ overview, sectionA[], sectionBIncluded, sectionC[], markingScheme, integrityAndSecurity, accessibilityProvisions, summary, validation, generatedAt, approvedAt }`.
- `overview`: `{ examTitle, credentialName, examPurpose, totalWeighting, totalDuration, totalMarks, deliveryModes[], permittedMaterials, sectionBreakdown[] }`.
- `sectionA[]` — array of MCQ/short-answer questions: `{ questionId, type, questionText, options[], correctAnswer, marks, bloomLevel, linkedMLOs[], linkedPLOs[], rationale }`. Sample has 20.
- `sectionC[]` — array of applied tasks: `{ taskId, taskDescription, instructions, marks, modelAnswer, assessmentCriteria, linkedMLOs[], linkedPLOs[] }`. Sample has 3.
- `sectionBIncluded` — boolean flag for whether section B is part of this exam.
- **Mapping:** create a single `Assignment` per workflow representing the summative. `sectionBreakdown[]` maps to `Assignment.sectionBreakdown[]`. Attach to a synthesized "Final Exam" session at the course level (or last module).

---

## Field mapping table (corrected)

| LMS entity / field | Generator path |
|---|---|
| `Course` | the workflow itself |
| `Course.sourceWorkflowId` | `workflow._id` |
| `Course.sourceWorkflowVersion` | `workflow.updatedAt` (use as version stamp; no semver field exists) |
| `Course.title` | `workflow.projectName` (or `workflow.step1.programTitle` if non-null) |
| `Course.description` | `workflow.step1.programDescription` |
| `Course.programLearningOutcomes[]` | `workflow.step3.outcomes[]` |
| `Module` | `workflow.step4.modules[i]` |
| `Module.code` | `module.code` |
| `Module.title` | `module.title` |
| `Module.aim` | `module.description` (no separate `aim` field) |
| `Module.coreElective` | not in source — default `'core'`, staff overrides |
| `Module.prerequisites[]` | `module.prerequisites` |
| `ModuleLearningOutcome` | `module.mlos[i]` |
| `ModuleLearningOutcome.linkedPLOs` | `mlo.linkedPLOs` |
| `ModuleLearningOutcome.linkedKSCs` | `mlo.competencyLinks` (renamed) |
| `Session` | `workflow.step10.moduleLessonPlans[m].lessons[i]` |
| `Session.sourceLessonId` | `lesson.lessonId` |
| `Session.title` | `lesson.lessonTitle` |
| `Session.linkedMLOs` | `lesson.linkedMLOs` |
| `Session.activities[]` | `lesson.activities` |
| `Session.formativeChecks[]` | `lesson.formativeChecks ?? []` |
| `Session.objectives[]` | `lesson.objectives` |
| `Session.duration` | `lesson.duration` |
| `Material` (slides) | `workflow.step11.modulePPTDecks[m].pptDecks[i]` |
| → attach to Session via | `pptDeck.lessonId === lesson.lessonId` |
| `Material.type` | `'slides'` |
| `Material.body` | `pptDeck.slides[]` (structured JSON; render in LMS) |
| `Assignment` (per-module) | `workflow.step12.moduleAssignmentPacks[m].variants[deliveryMode]` |
| `Assignment.sourceAssignmentPackId` | `variant.assignmentId` (fallback `${moduleCode}-${deliveryMode}` if undefined-prefixed) |
| `Assignment.deliveryVariant` | one of `self_study`, `hybrid`, `in_person` |
| `Assignment.linkedMLOs[]` | union of `variant.assessedOutcomes[].mloId` |
| `Assignment.submissionRequirements[]` | `variant.evidenceRequirements` |
| `Assignment.rubric` | `variant.rubric` |
| `Assignment.sectionBreakdown[]` | from `step13.overview.sectionBreakdown` for the summative variant |
| `Assignment` (summative) | `workflow.step13` (single) |

## File handling

For Phase A: **no streaming endpoint needed.** PPT slides are JSON, store as `Material.body`. If/when staff request real `.pptx` files, generator already has `POST /api/v3/ppt/download/module/:workflowId/:moduleIndex` returning a JSZip download. That route is auth-protected (`validateJWT`); treat as Phase B+.

## Persistence notes

- Use a Mongo transaction for the import. All-or-nothing.
- Idempotency: keyed on `sourceWorkflowId`. Re-import overwrites.
- `lastSyncedAt` set after successful commit.

## Open items still pending generator-side

None blocking Phase A. If you discover a real gap during implementation, list it in `curriculum-import/OPEN-QUESTIONS.md` and ping me.
