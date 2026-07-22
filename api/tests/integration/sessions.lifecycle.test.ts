import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
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
import { recoverStrandedSessions } from '../../src/services/sessionService.js';

// Phase B-2 — session lifecycle (complete / uncomplete / 7d undo lock /
// reorder / attendance). Each test scaffolds a course + module + 2
// sessions because the fixture factories don't currently emit Session/
// Module pairs from imports — and the import flow is exercised separately
// in the curriculum-import tests.

async function buildCourseModuleSessions() {
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
  const moduleB = await ModuleModel.create({
    courseId: course._id,
    title: 'Module B',
    order: 1,
    sourceModuleId: 'modB',
  });
  // 3 sessions on module A, 2 on module B.
  const sA0 = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 0,
    title: 'A0',
    sourceLessonId: 'A0',
  });
  const sA1 = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 1,
    title: 'A1',
    sourceLessonId: 'A1',
  });
  const sA2 = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 2,
    title: 'A2 — auto',
    synthesized: true,
    sourceLessonId: null,
  });
  const sB0 = await SessionModel.create({
    moduleId: moduleB._id,
    courseId: course._id,
    number: 0,
    title: 'B0',
    sourceLessonId: 'B0',
  });
  const sB1 = await SessionModel.create({
    moduleId: moduleB._id,
    courseId: course._id,
    number: 1,
    title: 'B1',
    sourceLessonId: 'B1',
  });
  const batch = await makeBatch({ programId: program._id });
  return {
    program,
    faculty,
    course,
    moduleA,
    moduleB,
    sessions: { sA0, sA1, sA2, sB0, sB1 },
    batch,
  };
}

describe('Phase B-2 — session lifecycle', () => {
  useMongo();
  useIntegrationSpies();

  describe('complete + uncomplete', () => {
    it('refuses to complete a session with no attendance', async () => {
      const { faculty, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`)
        .set(bearer(t));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ATTENDANCE_REQUIRED');
    });

    it('completes once attendance is recorded; sets the 7-day undo window', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(faculty);

      await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });

      const res = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`)
        .set(bearer(t));
      expect(res.status).toBe(200);
      expect(res.body.data.session.status).toBe('completed');
      expect(res.body.data.session.completedBy).toBe(faculty._id.toString());

      const undoUntil = new Date(res.body.data.session.completionUndoableUntil).getTime();
      const completedAt = new Date(res.body.data.session.completedAt).getTime();
      const diffDays = (undoUntil - completedAt) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThanOrEqual(6.99);
      expect(diffDays).toBeLessThanOrEqual(7.01);
    });

    it('uncompletes inside the 7-day window for the marker', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(faculty);
      await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });
      await http().post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`).set(bearer(t));

      const undo = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/uncomplete`)
        .set(bearer(t));
      expect(undo.status).toBe(200);
      expect(undo.body.data.session.status).toBe('in_progress');
      expect(undo.body.data.session.completedAt).toBeNull();
      expect(undo.body.data.session.completionUndoableUntil).toBeNull();
    });

    it('refuses uncomplete after the 7-day lock has expired', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(faculty);
      await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });
      await http().post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`).set(bearer(t));

      // Rewind the lock to 1 ms ago so the next uncomplete trips the lock.
      await SessionModel.updateOne(
        { _id: sessions.sA0._id },
        { $set: { completionUndoableUntil: new Date(Date.now() - 1) } },
      );

      const undo = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/uncomplete`)
        .set(bearer(t));
      expect(undo.status).toBe(409);
      expect(undo.body.error.code).toBe('COMPLETION_LOCKED');
    });

    it('a different faculty (not the marker) cannot uncomplete; superadmin can', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: facultyB } = await makeFaculty();
      // Add facultyB to the same course so the ownership check doesn't 403
      // before the marker check fires.
      await ModuleModel.updateOne({ _id: sessions.sA0.moduleId }, { $set: {} });
      const { Course } = await import('../../src/models/index.js');
      await Course.updateOne({ _id: course._id }, { $addToSet: { facultyIds: facultyB._id } });

      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });

      const tA = await tokenFor(faculty);
      await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(tA))
        .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });
      await http().post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`).set(bearer(tA));

      const tB = await tokenFor(facultyB);
      const tryB = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/uncomplete`)
        .set(bearer(tB));
      expect(tryB.status).toBe(403);

      // Per PR #12 (B2 blocker): oversight is read-only at the API. A
      // superadmin who is *not* on facultyIds cannot uncomplete — the
      // escape hatch is to add themselves to the roster first.
      const sa = await makeUser({ role: 'superadmin', password: 'Super#12345' });
      const tSA = await tokenFor(sa);
      const blocked = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/uncomplete`)
        .set(bearer(tSA));
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('OVERSIGHT_READONLY');

      // Superadmin on the roster *can* uncomplete (still subject to the
      // marker check — which they pass because superadmin gets the
      // existing marker-bypass once the roster check is satisfied).
      const { Course: Course2 } = await import('../../src/models/index.js');
      await Course2.updateOne({ _id: course._id }, { $addToSet: { facultyIds: sa._id } });
      const trySA = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/uncomplete`)
        .set(bearer(tSA));
      expect(trySA.status).toBe(200);
    });

    it('faculty NOT on the course gets 403', async () => {
      const { sessions } = await buildCourseModuleSessions();
      const { user: outside } = await makeFaculty();
      const t = await tokenFor(outside);
      const res = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`)
        .set(bearer(t));
      expect(res.status).toBe(403);
    });

    it('students cannot hit the staff endpoints (403)', async () => {
      const { course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(student);
      const a = await http().get(`/v1/sessions/${sessions.sA0._id.toString()}`).set(bearer(t));
      expect(a.status).toBe(403);
      const b = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/complete`)
        .set(bearer(t));
      expect(b.status).toBe(403);
    });
  });

  describe('attendance', () => {
    it('bulk upsert is idempotent and skips non-enrolled studentIds', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: studentA } = await makeStudent();
      const { user: studentB } = await makeStudent();
      const ghostId = new Types.ObjectId().toString();
      await makeEnrollment({
        studentId: studentA._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      await makeEnrollment({
        studentId: studentB._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(faculty);

      const r1 = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({
          records: [
            { studentId: studentA._id.toString(), status: 'present' },
            { studentId: studentB._id.toString(), status: 'absent' },
            { studentId: ghostId, status: 'present' },
          ],
        });
      expect(r1.status).toBe(200);
      expect(r1.body.data.records).toHaveLength(2);
      expect(r1.body.data.skipped).toContain(ghostId);

      // Re-submit with one row flipped.
      const r2 = await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({
          records: [{ studentId: studentB._id.toString(), status: 'late' }],
        });
      expect(r2.status).toBe(200);

      // Direct DB count: still 2 rows, B's status is now 'late'.
      const dbRows = await AttendanceRecord.find({ sessionId: sessions.sA0._id });
      expect(dbRows.length).toBe(2);
      const bRow = dbRows.find((r) => r.studentId.equals(studentB._id));
      expect(bRow!.status).toBe('late');
    });
  });

  describe('reorder', () => {
    it('within-module reorder renumbers siblings cleanly', async () => {
      const { faculty, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      // Move sA0 (currently number=0) to position 2 in module A.
      const res = await http()
        .patch(`/v1/sessions/${sessions.sA0._id.toString()}`)
        .set(bearer(t))
        .send({ orderIndex: 2 });
      expect(res.status).toBe(200);

      const fresh = await SessionModel.find({ moduleId: sessions.sA0.moduleId }).sort({ number: 1 });
      // sA1 → 0, sA2 (auto) → 1, sA0 → 2
      expect(fresh.map((s) => s.title)).toEqual(['A1', 'A2 — auto', 'A0']);
    });

    it('cross-module move places at target index and renumbers both modules', async () => {
      const { faculty, moduleB, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .patch(`/v1/sessions/${sessions.sA1._id.toString()}`)
        .set(bearer(t))
        .send({ moduleId: moduleB._id.toString(), orderIndex: 1 });
      expect(res.status).toBe(200);

      const moduleAFresh = await SessionModel.find({ moduleId: sessions.sA0.moduleId }).sort({ number: 1 });
      const moduleBFresh = await SessionModel.find({ moduleId: moduleB._id }).sort({ number: 1 });
      expect(moduleAFresh.map((s) => s.title)).toEqual(['A0', 'A2 — auto']);
      expect(moduleBFresh.map((s) => s.title)).toEqual(['B0', 'A1', 'B1']);
    });

    it('auto-generated sessions cannot be reordered', async () => {
      const { faculty, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .patch(`/v1/sessions/${sessions.sA2._id.toString()}`)
        .set(bearer(t))
        .send({ orderIndex: 0 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_AUTO_GENERATED');
    });

    it('auto-generated session title is read-only', async () => {
      const { faculty, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .patch(`/v1/sessions/${sessions.sA2._id.toString()}`)
        .set(bearer(t))
        .send({ title: 'try to rename' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_AUTO_GENERATED');
    });

    it('cross-course move is rejected', async () => {
      const { faculty, sessions } = await buildCourseModuleSessions();
      // Build a second course + module owned by the same faculty.
      const program2 = await makeProgram();
      const otherCourse = await makeCourse({
        programId: program2._id,
        facultyIds: [faculty._id],
      });
      const otherModule = await ModuleModel.create({
        courseId: otherCourse._id,
        title: 'Other M',
        order: 0,
      });
      const t = await tokenFor(faculty);
      const res = await http()
        .patch(`/v1/sessions/${sessions.sA0._id.toString()}`)
        .set(bearer(t))
        .send({ moduleId: otherModule._id.toString() });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CROSS_COURSE_MOVE_FORBIDDEN');
    });
  });

  describe('detail', () => {
    it('GET /v1/sessions/:id returns session + materials + assignments + attendance summary', async () => {
      const { faculty, course, batch, program, sessions } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
      const t = await tokenFor(faculty);
      await http()
        .post(`/v1/sessions/${sessions.sA0._id.toString()}/attendance`)
        .set(bearer(t))
        .send({ records: [{ studentId: student._id.toString(), status: 'present' }] });

      const res = await http().get(`/v1/sessions/${sessions.sA0._id.toString()}`).set(bearer(t));
      expect(res.status).toBe(200);
      expect(res.body.data.session.id).toBe(sessions.sA0._id.toString());
      expect(res.body.data.attendanceSummary.recorded).toBe(1);
      expect(res.body.data.attendanceSummary.present).toBe(1);
      expect(res.body.data.attendanceSummary.enrolled).toBe(1);
      expect(res.body.data.materials).toEqual([]);
      expect(res.body.data.assignments).toEqual([]);
    });

    it('GET /v1/courses/:id/sessions returns sessions ordered by module then number', async () => {
      const { faculty, course, sessions } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .get(`/v1/courses/${course._id.toString()}/sessions`)
        .set(bearer(t));
      expect(res.status).toBe(200);
      expect(res.body.data.sessions).toHaveLength(5);
      const titles = res.body.data.sessions.map((s: { title: string }) => s.title);
      // First three from module A, then two from module B.
      expect(titles.slice(0, 3)).toEqual(['A0', 'A1', 'A2 — auto']);
      expect(titles.slice(3)).toEqual(['B0', 'B1']);
      // isAutoGenerated flag exposed on the synthesized one.
      const auto = res.body.data.sessions.find((s: { title: string }) => s.title === 'A2 — auto');
      expect(auto.isAutoGenerated).toBe(true);
      expect(sessions.sA0.title).toBe('A0'); // sanity
    });
  });

  describe('reorder recovery (boot-time scan)', () => {
    it('repairs sessions parked at >= 1_000_000 (simulates a crash mid-reorder)', async () => {
      const { sessions } = await buildCourseModuleSessions();
      // Simulate the parking phase + crash: leave sA1 and sA2 at parking
      // numbers without ever flushing them back to a sane range.
      await SessionModel.updateOne({ _id: sessions.sA1._id }, { $set: { number: 1_000_001 } });
      await SessionModel.updateOne({ _id: sessions.sA2._id }, { $set: { number: 1_000_002 } });

      const result = await recoverStrandedSessions();
      expect(result.sessionsRecovered).toBe(2);
      expect(result.modulesScanned).toBe(1);

      // Module A renumbered to a sane sequence; sA0 (still at 0) stays
      // first, parked rows take the trailing positions in their parking
      // order.
      const fresh = await SessionModel.find({ moduleId: sessions.sA0.moduleId }).sort({ number: 1 });
      expect(fresh.map((s) => s.number)).toEqual([0, 1, 2]);
      expect(fresh.map((s) => s.title)).toEqual(['A0', 'A1', 'A2 — auto']);
    });

    it('is a no-op when nothing is parked', async () => {
      await buildCourseModuleSessions();
      const result = await recoverStrandedSessions();
      expect(result.sessionsRecovered).toBe(0);
      expect(result.modulesScanned).toBe(0);
    });
  });

  describe('add a lesson manually', () => {
    it('assigned faculty adds a lesson; it appends, is not auto-generated, and has no source id', async () => {
      const { faculty, course, moduleA } = await buildCourseModuleSessions();
      const t = await tokenFor(faculty);
      const res = await http()
        .post(`/v1/courses/${course._id.toString()}/sessions`)
        .set(bearer(t))
        .send({ moduleId: moduleA._id.toString(), title: 'Manual bonus lesson', plannedMinutes: 90 });
      expect(res.status).toBe(201);
      expect(res.body.data.session.title).toBe('Manual bonus lesson');
      // module A already had numbers 0,1,2 → appended at 3
      expect(res.body.data.session.orderIndex).toBe(3);
      expect(res.body.data.session.isAutoGenerated).toBe(false);
      // sourceLessonId null is what makes it survive a curriculum re-import
      expect(res.body.data.session.sourceLessonId).toBeNull();
      expect(await SessionModel.countDocuments({ moduleId: moduleA._id })).toBe(4);
    });

    it('rejects an admin not on the course roster (oversight is read-only)', async () => {
      const { course, moduleA } = await buildCourseModuleSessions();
      const admin = await makeUser({ role: 'admin', email: `adm-${Date.now()}@x.com` });
      const t = await tokenFor(admin);
      const res = await http()
        .post(`/v1/courses/${course._id.toString()}/sessions`)
        .set(bearer(t))
        .send({ moduleId: moduleA._id.toString(), title: 'nope' });
      expect(res.status).toBe(403);
    });

    it('rejects a student (not staff)', async () => {
      const { course, moduleA } = await buildCourseModuleSessions();
      const { user: student } = await makeStudent();
      const t = await tokenFor(student);
      const res = await http()
        .post(`/v1/courses/${course._id.toString()}/sessions`)
        .set(bearer(t))
        .send({ moduleId: moduleA._id.toString(), title: 'nope' });
      expect(res.status).toBe(403);
    });
  });
});
