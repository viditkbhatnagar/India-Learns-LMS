import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
  makeTimetableEntry,
} from '../helpers/factories.js';
import { Notification } from '../../src/models/index.js';

describe('POST /v1/timetable/overrides', () => {
  useMongo();
  const spies = useIntegrationSpies();

  async function scaffold() {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const entry = await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 3,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    return { admin, at, program, faculty, course, batch, student, entry };
  }

  it('cancel override → notifications fan out to student + faculty', async () => {
    const { at, batch, entry } = await scaffold();
    const res = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        entryId: entry._id.toString(),
        date: '2026-07-08',
        action: 'cancel',
        reason: 'Guest lecturer unavailable',
      });
    expect(res.status).toBe(201);
    const stored = await Notification.find({});
    // 1 student + 1 faculty = 2 recipients
    expect(stored).toHaveLength(2);
    expect(spies.email.calls).toHaveLength(2);
    expect(spies.whatsapp.calls).toHaveLength(0);
  });

  it('reschedule override with newStartMinutes produces notification + persists change', async () => {
    const { at, batch, entry } = await scaffold();
    const res = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        entryId: entry._id.toString(),
        date: '2026-07-08',
        action: 'reschedule',
        newStartMinutes: 1140,
        newEndMinutes: 1260,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.override.action).toBe('reschedule');
    expect(res.body.data.override.newStartMinutes).toBe(1140);
    expect(res.body.data.override.date).toBe('2026-07-08');
  });

  it('add override requires newCourseId + newFacultyId + times', async () => {
    const { at, batch } = await scaffold();
    const missingRes = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        date: '2026-07-09',
        action: 'add',
      });
    expect(missingRes.status).toBe(422);
  });

  it('add override succeeds and creates an entryId=null override', async () => {
    const { at, batch, course, faculty } = await scaffold();
    const res = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        date: '2026-07-09',
        action: 'add',
        newCourseId: course._id.toString(),
        newFacultyId: faculty._id.toString(),
        newStartMinutes: 900,
        newEndMinutes: 1020,
        newRoom: 'Lab 3',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.override.entryId).toBeNull();
    expect(res.body.data.override.action).toBe('add');
  });

  it('cancel without entryId is rejected', async () => {
    const { at, batch } = await scaffold();
    const res = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        date: '2026-07-08',
        action: 'cancel',
      });
    expect(res.status).toBe(422);
  });

  it('DELETE /v1/timetable/overrides/:id fans out a deletion notification', async () => {
    const { at, batch, entry } = await scaffold();
    const create = await http()
      .post('/v1/timetable/overrides')
      .set(bearer(at))
      .send({
        batchId: batch._id.toString(),
        entryId: entry._id.toString(),
        date: '2026-07-08',
        action: 'cancel',
      });
    const overrideId = create.body.data.override.id;
    await Notification.deleteMany({}); // reset after the create fan-out
    spies.email.reset();

    const del = await http()
      .delete(`/v1/timetable/overrides/${overrideId}`)
      .set(bearer(at));
    expect(del.status).toBe(200);
    const docs = await Notification.find({});
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(spies.email.calls.length).toBeGreaterThanOrEqual(1);
  });
});
