# Final prompt — paste this into the India Learns LMS Claude Code chat

---

All four blockers from your last reply are answered. Generator backend is live and responding (just curled `/health` — DB + cache healthy). Sample workflow is fetched and saved into the repo for you. Read the files; don't try to re-fetch.

## 1. API base URL

```
https://curriculum-api-bsac.onrender.com
```

- `GET /health` works (no auth).
- `GET /api/v3/workflow/:id` works (no auth — confirmed at `routes/workflowRoutes.ts:215`).
- Mutation routes (POST/PUT) gate on Auth0 JWT; reads do not. For Phase A you only need reads.
- Render free tier sleeps after ~15 min idle — first hit can take ~30 s.

## 2. Real workflow JSON — already saved into the repo

I fetched a completed real workflow ("Maths Certification", 8 modules, 98 lessons, status `review_pending` with all 13 steps populated) and saved both versions into the repo:

- **`curriculum-import/sample-workflow-full.json`** — 5.7 MB, raw response from `GET /api/v3/workflow/69bbf3cd5c4093e441e75eba`. Use this for the Zod schema work.
- **`curriculum-import/sample-workflow-slim.json`** — 500 KB, structurally complete with arrays trimmed (one module, one lesson, one PPT deck, one assignment variant, full step13). Easier to load into context.
- **`curriculum-import/SCHEMA-NOTES.md`** — read this before writing any Zod. It documents every field-name correction vs. the v0.1 PDF, plus the canonical mapping table.

Sample workflow ID for live testing: **`69bbf3cd5c4093e441e75eba`**.

## 3. Endpoint check — yes, the single `GET /api/v3/workflow/:id` returns the full nested doc

All step1…step13 sub-documents come back populated in one call. No `lms-export` endpoint needed. Helpful adjuncts that already exist if you want them: `GET /:id/progress`, `GET /:id/step10`, `GET /:id/step10/status`, `GET /:id/step11/status`, `GET /:id/step12/status`.

## 4. PPT / case-file storage — no streaming endpoint needed for Phase A

The PPT decks in this generator are **structured slide JSON, not .pptx files**. `step11.modulePPTDecks[].pptDecks[].slides[]` is an array of `{ slideNumber, slideType, title, content, speakerNotes }`. Store the JSON as a `Material` (type=`slides`) on the matching `Session` (joined on `lessonId`). The LMS can render its own slide preview from JSON — Reveal.js / a simple slide viewer / or convert to .pptx on demand.

If staff later need a real `.pptx` download, the generator already has `POST /api/v3/ppt/download/module/:workflowId/:moduleIndex` which renders + streams a JSZip — but it's auth-protected and out of Phase A scope. Don't build for it now.

So the file-streaming endpoint we discussed last round is **descoped — not needed**.

## 5. Phase A only — confirmed

Curriculum import + new model fields + transactional persistence behind super-admin gate. Don't start the faculty rebuild yet.

## Important schema corrections (v0.1 PDF was wrong on these — see SCHEMA-NOTES.md for the full list)

- Path is `/api/v3/workflow/:id`, not `/api/workflow/:id`.
- Response is `{ success: true, data: <workflow> }` — don't drop `.data`.
- `step3.outcomes[]`, NOT `step3.plos[]`.
- `step4.modules[].mlos[]`, NOT `learningOutcomes[]`.
- MLOs have `competencyLinks[]`, NOT `linkedKSCs[]` (only PLOs have `linkedKSCs`).
- `step11.modulePPTDecks[]`, NOT `step11.pptDecks[]`.
- `step12.moduleAssignmentPacks[]`, NOT `step12.assignmentPacks[]`.
- `step12.moduleAssignmentPacks[].variants` is an OBJECT keyed by `self_study | hybrid | in_person`, not an array, and the keys are not the "Online/Blended/In-Person" strings the PDF used.
- `step13` is a single object with `sectionA[]` and `sectionC[]` arrays plus `overview` and `sectionBIncluded` boolean — not an array.
- Module has `description`, not `aim`. No `coreElective` field exists in source — default to `'core'` on import and let staff override.
- Some `step12` `assignmentId` values come through as `"undefined-<variant>"` due to a generator-side bug where the module code was undefined at generation time. Validate; fall back to `${moduleCode}-${deliveryVariant}`.

## Build sequence (per §9.9, refined)

1. **Read `SCHEMA-NOTES.md` and `sample-workflow-slim.json` first.** Don't write Zod against the PDF — write it against the actual JSON.
2. **Migrations / model extensions** — add the fields you listed:
   - `Course.sourceWorkflowId`, `sourceWorkflowVersion`, `lastSyncedAt`, `programLearningOutcomes[]`
   - `Module.code`, `coreElective`, `aim`, `prerequisites[]`, `learningOutcomes[]` with `linkedPLOs`, `linkedKSCs`
   - `Session.sourceLessonId`, `linkedMLOs[]`, `activities[]`, `formativeChecks[]`, `objectives[]`
   - `Assignment.sourceAssignmentPackId`, `linkedMLOs[]`, `submissionRequirements[]`, `sectionBreakdown[]`, `deliveryVariant`
3. **Zod validator** for the full workflow shape — write it against `sample-workflow-full.json` so it survives every weird optional case (null `step1.programTitle`, empty `formativeChecks`, undefined-prefixed `assignmentId`, etc.). Validate at the import boundary; never trust the wire.
4. **Pure transformer fn** `transformWorkflowToCourseImport(workflow): { course, modules, sessions, materials, assignments }`. Unit tests use the slim JSON as fixture. Document every defaulting decision (e.g. `coreElective='core'`, synthesized "Assessment" sessions for assignment packs, summative as a single dedicated assignment).
5. **API client** — thin axios wrapper, `fetchWorkflow(id)` that handles cold-start retries (one retry after 30 s if 502/504), unwraps `.data`, and pipes through Zod.
6. **Preview UI** — super-admin-only screen showing the diff between the workflow and what would be imported (counts of modules / sessions / assignments / slides). Confirm-then-import.
7. **Transactional persister** — Mongo session, all writes inside a transaction, idempotent on `sourceWorkflowId` (re-import overwrites; record `lastSyncedAt`). Roll back on any failure, surface a clean error.
8. **Super-admin gate** instead of feature flag.

## Approvals confirmed (from prior round)

- Sync model: Option A one-time import, store `sourceWorkflowId` + `sourceWorkflowVersion` for future re-sync.
- File handling: `Material.body` stores slide JSON (no Cloudinary copy in Phase A — slides aren't files).
- DnD lib: `@dnd-kit/core` (defer until Phase B since this is import-only).
- Pilot gate: super-admin role check.

## What's NOT in Phase A

Faculty UI rebuild (§7), Course→Module→Session navigation tree, gradebook grid, two-step grade publish, attendance, drag-and-drop reordering. All Phase B.

## Action

Read `curriculum-import/SCHEMA-NOTES.md` → read `curriculum-import/sample-workflow-slim.json` → write the migrations → write Zod against the full JSON → write the transformer + tests → wire the route + UI behind super-admin → import the sample workflow ID `69bbf3cd5c4093e441e75eba` end-to-end. Ship it behind super-admin only. Open a PR when the import round-trips one real workflow.

If anything in `SCHEMA-NOTES.md` doesn't match what you see in the JSON, **trust the JSON and update the notes** — I generated those notes from the same JSON, but the JSON wins.
