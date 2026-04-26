import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
  makeUser,
} from '../helpers/factories.js';
import {
  AttendanceRecord,
  ModuleModel,
  SessionModel,
} from '../../src/models/index.js';

// PR #12 — B2 blocker fix. Oversight (admin/superadmin not on facultyIds)
// must be read-only at the API layer. The UI mirrors this with disabled
// buttons + a persistent banner, but the server is the source of truth:
// a stray request from a custom client (or a stale browser tab from
// before the UI gate landed) must not silently mutate teaching state.
//
// What "faculty-tier writes" cover, per the developer-handoff PDF §5+§10
// and PRD §3.1:
//   - Recording attendance
//   - Marking a session complete / uncompleting it within the 7-day window
//   - Editing a session's notes / title / metadata / order
// Course-management writes (delete course, edit course header) are not
// covered here — they're admin-tier and handled in courses.crud tests.

async function buildCourse() {
  const program = await makeProgram();
  const { user: faculty } = await makeFaculty();
  const course = await makeCourse({
    programId: program._id,
    facultyIds: [faculty._id],
  });
  const moduleA = await ModuleModel.create({
    courseId: course._id,
    title: 'Module A',
    order: 0,
    sourceModuleId: 'modA',
  });
  const session = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 0,
    title: 'A0',
    sourceLessonId: 'A0',
  });
  const batch = await makeBatch({ programId: program._id });
  const { user: student } = await makeStudent();
  await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
  });
  return { course, faculty, session, student };
}

describe('PR #12 — oversight mode is read-only at the API layer', () => {
  useMongo();
  useIntegrationSpies();

  it('superadmin not on facultyIds: POST attendance → 403 OVERSIGHT_READONLY', async () => {
    const { session, student } = await buildCourse();
    const superadmin = await makeUser({ role: 'superadmin' });
    const t = await tokenFor(superadmin);
    const res = await http()
      .post(`/v1/sessions/${session._id.toString()}/attendance`)
      .set(bearer(t))
      .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OVERSIGHT_READONLY');
    // No record created — the server bailed before the upsert.
    expect(await AttendanceRecord.countDocuments({ sessionId: session._id })).toBe(0);
  });

  it('superadmin not on facultyIds: POST /complete → 403 OVERSIGHT_READONLY', async () => {
    const { session } = await buildCourse();
    const superadmin = await makeUser({ role: 'superadmin' });
    const t = await tokenFor(superadmin);
    const res = await http()
      .post(`/v1/sessions/${session._id.toString()}/complete`)
      .set(bearer(t));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OVERSIGHT_READONLY');
    const fresh = await SessionModel.findById(session._id);
    expect(fresh?.status).toBe('upcoming');
  });

  it('superadmin not on facultyIds: PATCH /:id (notes) → 403 OVERSIGHT_READONLY', async () => {
    const { session } = await buildCourse();
    const superadmin = await makeUser({ role: 'superadmin' });
    const t = await tokenFor(superadmin);
    const res = await http()
      .patch(`/v1/sessions/${session._id.toString()}`)
      .set(bearer(t))
      .send({ notes: 'oversight should not be able to write this' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OVERSIGHT_READONLY');
    const fresh = await SessionModel.findById(session._id);
    expect(fresh?.notes ?? '').not.toContain('oversight should not');
  });

  it('admin not on facultyIds: same write path → 403 OVERSIGHT_READONLY', async () => {
    const { session } = await buildCourse();
    const admin = await makeUser({ role: 'admin' });
    const t = await tokenFor(admin);
    const res = await http()
      .patch(`/v1/sessions/${session._id.toString()}`)
      .set(bearer(t))
      .send({ notes: 'admin oversight write' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OVERSIGHT_READONLY');
  });

  it('superadmin ON facultyIds: writes succeed (escape hatch — add yourself to the roster)', async () => {
    const program = await makeProgram();
    const superadmin = await makeUser({ role: 'superadmin' });
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [superadmin._id],
    });
    const moduleA = await ModuleModel.create({
      courseId: course._id,
      title: 'Module A',
      order: 0,
      sourceModuleId: 'modA',
    });
    const session = await SessionModel.create({
      moduleId: moduleA._id,
      courseId: course._id,
      number: 0,
      title: 'A0',
      sourceLessonId: 'A0',
    });
    const t = await tokenFor(superadmin);
    const res = await http()
      .patch(`/v1/sessions/${session._id.toString()}`)
      .set(bearer(t))
      .send({ notes: 'authorised — superadmin is on facultyIds' });
    expect(res.status).toBe(200);
    const fresh = await SessionModel.findById(session._id);
    expect(fresh?.notes).toBe('authorised — superadmin is on facultyIds');
  });

  it('faculty on facultyIds: writes still succeed (regression guard)', async () => {
    const { session, faculty } = await buildCourse();
    const t = await tokenFor(faculty);
    const res = await http()
      .patch(`/v1/sessions/${session._id.toString()}`)
      .set(bearer(t))
      .send({ notes: 'faculty notes' });
    expect(res.status).toBe(200);
  });

  it('GET endpoints stay readable for superadmin in oversight (regression — only writes are blocked)', async () => {
    const { session } = await buildCourse();
    const superadmin = await makeUser({ role: 'superadmin' });
    const t = await tokenFor(superadmin);
    const res = await http()
      .get(`/v1/sessions/${session._id.toString()}`)
      .set(bearer(t));
    expect(res.status).toBe(200);
    expect(res.body.data.session.id).toBe(session._id.toString());
  });
});
