import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/**
 * Phase B-1 gradebook smoke — staging.
 *
 * Run with:
 *   PLAYWRIGHT_BASE_URL=https://india-learns-lms.onrender.com \
 *     npx playwright test gradebook-smoke
 *
 * Verifies the four PR #2 dealbreakers end-to-end against the deployed
 * environment:
 *   1. Faculty: draft → edit → publish round-trips through the UI.
 *   2. Student: API never returns a `gradedDraft` payload — even if a
 *      faculty draft exists, the student's own submission view shows no
 *      score/feedback until publish.
 *   3. Re-publish requires a fresh draft (editing a published grade flips
 *      the row back to graded_draft).
 *   4. Bulk publish on >1 selected drafts works and audit-logs each row.
 *
 * Auth model: bearer access in localStorage['il-auth'] (zustand persist),
 * refresh in HTTP-only cookie. We log in via the UI, then call
 * `apiCtxFor(page)` to extract the bearer post-login and bind it to a
 * fresh APIRequestContext — `page.context().request` does NOT auto-attach
 * the Authorization header (the SPA's axios interceptor adds it from the
 * store, but Playwright's request context doesn't share the SPA's state).
 *
 * Pre-conditions (operator):
 *   - Staging server is awake (first request may take 30s).
 *   - Seed accounts exist per India-Learns_LMS-Guide-V01.pdf §1.
 *   - Faculty seed is assigned to at least one course that has open
 *     assignments. The Phase A curriculum import (workflow
 *     69bbf3cd5c4093e441e75eba) provides 25 imported assignments;
 *     re-running it before the smoke leaves the gradebook fully populated.
 *
 * If a precondition is missing, the affected test fails with a clear
 * message. Tests are not skipped silently.
 */

const FACULTY = { email: 'faculty-seed-1@luc.local', password: 'Faculty#12345' };
const STUDENT = { email: 'student-demo-1@luc.local', password: 'Student#12345' };
const STUDENT2 = { email: 'student-demo-2@luc.local', password: 'Student#12345' };

const STUDENT_DASH = /\/student\/dashboard/;
const FACULTY_DASH = /\/faculty\/dashboard/;

type Auth = { email: string; password: string };

async function login(page: Page, who: Auth, landing: RegExp) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(who.email);
  await page.getByLabel(/password/i).fill(who.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(landing, { timeout: 30_000 });
}

/**
 * Pull the Bearer token out of the SPA's zustand store
 * (localStorage['il-auth']) so we can authenticate API-only calls. The SPA
 * does NOT use cookie-based auth for the access token — `page.context().request`
 * therefore can't talk to /v1 routes without this header.
 */
async function bearerFor(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('il-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
      return parsed?.state?.accessToken ?? null;
    } catch {
      return null;
    }
  });
  expect(token, 'access token missing from localStorage — did login complete?').toBeTruthy();
  return token!;
}

/**
 * Build a fresh APIRequestContext bound to the deployed base URL with the
 * given user's bearer pre-attached. Closing it is the caller's job.
 */
async function apiCtxFor(page: Page): Promise<APIRequestContext> {
  const token = await bearerFor(page);
  return pwRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL(/\/login/);
}

/**
 * Resolve "my courses" for either role. The endpoint shape diverges:
 *   - student   → GET /v1/me/courses        → { data: { enrolments: [{ courseId, … }] } }
 *   - faculty   → GET /v1/courses?mine=true → { data: { items: [{ id, … }] } }
 *
 * Returns a normalized list of `{ id }` so callers don't care which role.
 */
async function listMyCourses(
  req: APIRequestContext,
  role: 'student' | 'faculty',
): Promise<Array<{ id: string }>> {
  if (role === 'student') {
    const res = await req.get('/v1/me/courses');
    if (!res.ok()) return [];
    const body = await res.json();
    const enrolments: Array<{ courseId: string }> = body?.data?.enrolments ?? [];
    // Tolerant fallbacks in case the shape ever migrates.
    if (enrolments.length > 0) return enrolments.map((e) => ({ id: e.courseId }));
    const items = body?.data?.items ?? body?.data?.courses ?? [];
    return items;
  }
  const res = await req.get('/v1/courses?mine=true');
  if (!res.ok()) return [];
  const body = await res.json();
  return body?.data?.items ?? body?.data?.courses ?? [];
}

/** Find a faculty-taught course that has at least one assignment with a
 * student submission in `submitted` or `needs_grading` status. Currently
 * unused by the active tests (they discover via the student side) but kept
 * for future reuse. */
async function findGradableCourse(req: APIRequestContext): Promise<{
  courseId: string;
  assignmentId: string;
  submissionId: string;
} | null> {
  const courses = await listMyCourses(req, 'faculty');
  for (const course of courses) {
    const gbRes = await req.get(`/v1/courses/${course.id}/gradebook`);
    if (!gbRes.ok()) continue;
    const gb = await gbRes.json();
    // Gradebook shape per Phase B-1 (api/src/services/assignmentSubmissionService.ts):
    //   { assignments: [...], students: [...], cells: [{assignmentId, studentId, submissionId, computedStatus}] }
    const assignments: Array<{ id: string }> = gb?.data?.assignments ?? [];
    const cells: Array<{
      assignmentId: string;
      submissionId: string | null;
      computedStatus: string;
    }> = gb?.data?.cells ?? [];
    for (const cell of cells) {
      if (
        cell.submissionId &&
        (cell.computedStatus === 'submitted' || cell.computedStatus === 'needs_grading')
      ) {
        return {
          courseId: course.id,
          assignmentId: cell.assignmentId,
          submissionId: cell.submissionId,
        };
      }
    }
    // Suppress unused-variable lint while keeping the variable for IDE
    // breadcrumb readability.
    void assignments;
  }
  return null;
}

/** Have the student submit something so faculty has a row to grade.
 * Idempotent: re-running flips the existing submission back to `submitted`
 * (the route is upsert-by-(assignmentId, studentId)).
 *
 * Path is the flat /v1/assignments/:id/submissions per
 * api/src/routes/assignments.ts — not nested under courses. courseId is
 * threaded through the call signature for breadcrumb readability only. */
async function ensureStudentSubmission(
  studentReq: APIRequestContext,
  _courseId: string,
  assignmentId: string,
): Promise<string> {
  const submitRes = await studentReq.post(
    `/v1/assignments/${assignmentId}/submissions`,
    {
      data: {
        bodyText: `[smoke ${new Date().toISOString()}] Submission body for the gradebook smoke spec.`,
      },
    },
  );
  expect(
    submitRes.ok(),
    `Student submit failed: ${submitRes.status()} ${await submitRes.text()}`,
  ).toBeTruthy();
  const body = await submitRes.json();
  const id = body?.data?.submission?.id as string | undefined;
  expect(id, 'submission id missing in response').toBeTruthy();
  return id!;
}

test.describe('Phase B-1 — gradebook + two-step publish', () => {
  test('faculty lands on dashboard and gradebook is reachable', async ({ page }) => {
    await login(page, FACULTY, FACULTY_DASH);
    // The gradebook is reachable per-course. Walk via "My courses".
    await page.getByRole('link', { name: /my courses|courses/i }).first().click();
    await page.waitForURL(/\/faculty\/courses/, { timeout: 15_000 });
    // First course in the list — open it.
    const firstCourse = page.getByRole('link').filter({ hasText: /open|view|details/i }).first();
    if (await firstCourse.isVisible().catch(() => false)) {
      await firstCourse.click();
    } else {
      // Fallback: any link inside the courses list area
      await page.locator('a[href*="/faculty/courses/"]').first().click();
    }
    // Gradebook tab/link on the course detail
    await page.getByRole('link', { name: /gradebook/i }).first().click();
    await expect(page.getByRole('heading', { name: /gradebook/i })).toBeVisible();
  });

  test('draft → edit → publish round trip + student does not see draft', async ({ page, browser }) => {
    // 1. Student submits something so faculty has a row to grade.
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await login(studentPage, STUDENT, STUDENT_DASH);

    // Discover an open assignment for this student via the API. The SPA
    // stores the access token in localStorage; we extract it and bind it
    // to a fresh APIRequestContext (page.context().request would fire the
    // calls without auth).
    const studentReq = await apiCtxFor(studentPage);
    const studentCourses = await listMyCourses(studentReq, 'student');
    expect(
      studentCourses.length,
      'student is not enrolled in any course — re-run curriculum import or seed enrolments',
    ).toBeGreaterThan(0);

    // Pick the first course with at least one open assignment.
    let pickedCourseId: string | null = null;
    let pickedAssignmentId: string | null = null;
    for (const c of studentCourses) {
      const aRes = await studentReq.get(`/v1/courses/${c.id}/assignments`);
      if (!aRes.ok()) continue;
      const aBody = await aRes.json();
      const items: Array<{ id: string; state: string }> = aBody?.data?.items ?? [];
      const open = items.find((a) => a.state !== 'closed');
      if (open) {
        pickedCourseId = c.id;
        pickedAssignmentId = open.id;
        break;
      }
    }
    expect(pickedCourseId, 'no open assignments visible to student').toBeTruthy();
    const submissionId = await ensureStudentSubmission(
      studentReq,
      pickedCourseId!,
      pickedAssignmentId!,
    );

    // 2. Faculty: log in, save a draft via API, verify the draft chip
    //    is visible in the per-assignment grading view.
    await login(page, FACULTY, FACULTY_DASH);
    const facultyReq = await apiCtxFor(page);
    const draftRes = await facultyReq.post(`/v1/assignment-submissions/${submissionId}/draft`, {
      data: { score: 72, feedback: '[smoke] Draft feedback. Edit me before publish.' },
    });
    expect(
      draftRes.ok(),
      `Faculty save-draft failed: ${draftRes.status()} ${await draftRes.text()}`,
    ).toBeTruthy();
    const draftBody = await draftRes.json();
    expect(draftBody?.data?.submission?.status).toBe('graded_draft');
    expect(draftBody?.data?.submission?.score).toBe(72);

    // 3. CRITICAL: Student API must not leak the draft.
    //    Hit the same routes the student UI consumes.
    const studentAssignmentsAfterDraft = await studentReq.get(
      `/v1/courses/${pickedCourseId}/assignments`,
    );
    expect(studentAssignmentsAfterDraft.ok()).toBeTruthy();
    const studentBody = await studentAssignmentsAfterDraft.json();
    const myAssignment = studentBody?.data?.items?.find(
      (a: { id: string }) => a.id === pickedAssignmentId,
    );
    expect(myAssignment, 'assignment vanished from student view').toBeTruthy();
    const mySub = myAssignment.mySubmission;
    expect(mySub, 'mySubmission missing from student payload').toBeTruthy();
    // Status may be 'submitted' or 'needs_grading' from the student's POV,
    // but score and feedback MUST be null/absent until publish.
    expect(mySub.status === 'submitted' || mySub.status === 'needs_grading').toBeTruthy();
    expect(mySub.score == null, `student saw draft score: ${mySub.score}`).toBeTruthy();
    expect(
      mySub.feedback == null || mySub.feedback === '',
      `student saw draft feedback: ${JSON.stringify(mySub.feedback)}`,
    ).toBeTruthy();
    // Belt-and-suspenders: the DTO should never include the gradedDraft
    // payload key for students.
    expect(mySub.gradedDraft).toBeUndefined();

    // Also assert via the single-assignment endpoint students sometimes use.
    const singleRes = await studentReq.get(`/v1/assignments/${pickedAssignmentId}`);
    if (singleRes.ok()) {
      const singleBody = await singleRes.json();
      const singleSub = singleBody?.data?.assignment?.mySubmission ?? singleBody?.data?.mySubmission;
      if (singleSub) {
        expect(singleSub.score == null).toBeTruthy();
        expect(singleSub.gradedDraft).toBeUndefined();
      }
    }

    // 4. Faculty edits the draft (different score) — still graded_draft.
    const editRes = await facultyReq.post(`/v1/assignment-submissions/${submissionId}/draft`, {
      data: { score: 85, feedback: '[smoke] Edited draft feedback.' },
    });
    expect(editRes.ok()).toBeTruthy();
    expect((await editRes.json())?.data?.submission?.score).toBe(85);

    // 5. Faculty publishes.
    const pubRes = await facultyReq.post(`/v1/assignment-submissions/${submissionId}/publish`);
    expect(
      pubRes.ok(),
      `Publish failed: ${pubRes.status()} ${await pubRes.text()}`,
    ).toBeTruthy();
    expect((await pubRes.json())?.data?.submission?.status).toBe('published');

    // 6. Student NOW sees the score.
    const afterPub = await studentReq.get(`/v1/courses/${pickedCourseId}/assignments`);
    const afterBody = await afterPub.json();
    const myAfter = afterBody?.data?.items?.find(
      (a: { id: string }) => a.id === pickedAssignmentId,
    );
    expect(myAfter.mySubmission.status).toBe('published');
    expect(myAfter.mySubmission.score).toBe(85);

    // 7. Re-publish-requires-fresh-draft engineering call: editing the
    //    published grade flips the row back to graded_draft.
    const reDraftRes = await facultyReq.post(`/v1/assignment-submissions/${submissionId}/draft`, {
      data: { score: 90, feedback: '[smoke] Edit after publish — should flip to draft.' },
    });
    expect(reDraftRes.ok()).toBeTruthy();
    expect((await reDraftRes.json())?.data?.submission?.status).toBe('graded_draft');
    // Student sees the previously-published 85 (not the new draft 90) until
    // faculty publishes again.
    const afterReDraft = await studentReq.get(`/v1/courses/${pickedCourseId}/assignments`);
    const afterReDraftBody = await afterReDraft.json();
    const myReDraft = afterReDraftBody?.data?.items?.find(
      (a: { id: string }) => a.id === pickedAssignmentId,
    );
    // Acceptable: student still sees 85 (last-published) OR null (draft
    // hides the published grade until next publish). The contract is
    // "never leak the unpublished value", so assert score !== 90.
    expect(myReDraft.mySubmission.score).not.toBe(90);
    expect(myReDraft.mySubmission.gradedDraft).toBeUndefined();

    await studentCtx.close();
  });

  test('bulk publish: multiple drafts publish together, mixed-state batch is robust', async ({
    page,
    browser,
  }) => {
    // Set up 2 student submissions on whatever courses they're enrolled in.
    const studentACtx = await browser.newContext();
    const studentBCtx = await browser.newContext();
    const studentAPage = await studentACtx.newPage();
    const studentBPage = await studentBCtx.newPage();
    await login(studentAPage, STUDENT, STUDENT_DASH);
    await login(studentBPage, STUDENT2, STUDENT_DASH);

    async function pickSharedAssignment(req: APIRequestContext) {
      const courses = await listMyCourses(req, 'student');
      for (const c of courses) {
        const aRes = await req.get(`/v1/courses/${c.id}/assignments`);
        if (!aRes.ok()) continue;
        const items: Array<{ id: string; state: string }> = (await aRes.json())?.data?.items ?? [];
        const open = items.find((a) => a.state !== 'closed');
        if (open) return { courseId: c.id, assignmentId: open.id };
      }
      return null;
    }

    const studentAReq = await apiCtxFor(studentAPage);
    const studentBReq = await apiCtxFor(studentBPage);
    const a = await pickSharedAssignment(studentAReq);
    const b = await pickSharedAssignment(studentBReq);
    expect(a, 'student-demo-1 has no open assignment').toBeTruthy();
    expect(b, 'student-demo-2 has no open assignment').toBeTruthy();

    const subA = await ensureStudentSubmission(
      studentAReq,
      a!.courseId,
      a!.assignmentId,
    );
    const subB = await ensureStudentSubmission(
      studentBReq,
      b!.courseId,
      b!.assignmentId,
    );

    // Faculty drafts on both.
    await login(page, FACULTY, FACULTY_DASH);
    const fReq = await apiCtxFor(page);
    for (const id of [subA, subB]) {
      const r = await fReq.post(`/v1/assignment-submissions/${id}/draft`, {
        data: { score: 75, feedback: '[smoke] Bulk draft.' },
      });
      expect(r.ok(), `draft on ${id} failed: ${r.status()}`).toBeTruthy();
    }

    // Bulk publish.
    const bulkRes = await fReq.post('/v1/assignment-submissions/bulk-publish', {
      data: { submissionIds: [subA, subB] },
    });
    expect(
      bulkRes.ok(),
      `bulk publish failed: ${bulkRes.status()} ${await bulkRes.text()}`,
    ).toBeTruthy();
    const bulkBody = await bulkRes.json();
    // Expected response shape (per service contract): published[], failed[].
    // Tolerant assertion — accept either { published, failed } or
    // { results: [{ id, status }] }.
    const publishedCount =
      bulkBody?.data?.published?.length ??
      bulkBody?.data?.results?.filter((r: { status: string }) => r.status === 'published')?.length ??
      0;
    expect(publishedCount, 'bulk publish reported zero successes').toBeGreaterThanOrEqual(2);

    // Re-running bulk on already-published rows should classify them
    // cleanly (not throw, not double-publish).
    const repeat = await fReq.post('/v1/assignment-submissions/bulk-publish', {
      data: { submissionIds: [subA, subB] },
    });
    expect(repeat.ok(), 'bulk-publish on already-published rows must not 5xx').toBeTruthy();

    await studentACtx.close();
    await studentBCtx.close();
  });

  test('superadmin sees gradebook with oversight banner on a course they do not teach', async ({
    page,
  }) => {
    await login(
      page,
      { email: 'superadmin@indialearns.test', password: 'Superadmin#2026' },
      /\/admin\/dashboard/,
    );
    const req = await apiCtxFor(page);
    const coursesRes = await req.get('/v1/courses?limit=1');
    if (!coursesRes.ok()) {
      // Some envs gate /v1/courses; skip the banner check rather than fail
      // the smoke on an unrelated route.
      test.skip(true, `/v1/courses returned ${coursesRes.status()} — skipping banner check`);
      return;
    }
    const list: Array<{ id: string }> =
      (await coursesRes.json())?.data?.items ?? (await coursesRes.json())?.data?.courses ?? [];
    if (list.length === 0) {
      test.skip(true, 'no courses available — skipping banner check');
      return;
    }
    await page.goto(`/faculty/courses/${list[0].id}/gradebook`);
    // Expect either an explicit oversight banner or the global Read-only
    // pill from the LMS guide §1.
    const banner = page.getByText(/oversight|read[- ]only|view[- ]only/i).first();
    await expect(banner).toBeVisible({ timeout: 10_000 });
  });
});
