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
  makeFaculty,
  makeProgram,
  makeStudent,
  makeTimetableEntry,
} from '../helpers/factories.js';

describe('/v1/batches/:id/timetable and /v1/timetable/:entryId', () => {
  useMongo();
  useIntegrationSpies();

  async function scaffold() {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const facultyAt = await tokenFor(faculty);
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    return { admin, at, program, faculty, facultyAt, course, batch };
  }

  it('admin creates, lists, patches, and deletes a timetable entry', async () => {
    const { at, faculty, course, batch } = await scaffold();
    const createRes = await http()
      .post(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(at))
      .send({
        courseId: course._id.toString(),
        facultyId: faculty._id.toString(),
        dayOfWeek: 1,
        startTimeMinutes: 1080,
        endTimeMinutes: 1200,
        room: 'Room 1',
      });
    expect(createRes.status).toBe(201);
    const entryId = createRes.body.data.entry.id;

    const listRes = await http()
      .get(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(at));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.entries).toHaveLength(1);

    const patchRes = await http()
      .patch(`/v1/timetable/${entryId}`)
      .set(bearer(at))
      .send({ notes: 'Updated notes' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.entry.notes).toBe('Updated notes');

    const delRes = await http()
      .delete(`/v1/timetable/${entryId}`)
      .set(bearer(at));
    expect(delRes.status).toBe(200);
  });

  it('rejects overlapping entry with TIMETABLE_OVERLAP', async () => {
    const { at, faculty, course, batch } = await scaffold();
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    const res = await http()
      .post(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(at))
      .send({
        courseId: course._id.toString(),
        facultyId: faculty._id.toString(),
        dayOfWeek: 1,
        startTimeMinutes: 1140,
        endTimeMinutes: 1260,
        room: 'Room 1',
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TIMETABLE_OVERLAP');
  });

  it('non-admin cannot POST an entry (403)', async () => {
    const { facultyAt, faculty, course, batch } = await scaffold();
    const res = await http()
      .post(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(facultyAt))
      .send({
        courseId: course._id.toString(),
        facultyId: faculty._id.toString(),
        dayOfWeek: 1,
        startTimeMinutes: 1080,
        endTimeMinutes: 1200,
      });
    expect(res.status).toBe(403);
  });

  it('student cannot list entries (requireRole)', async () => {
    const { user: student } = await makeStudent();
    const sat = await tokenFor(student);
    const { batch } = await scaffold();
    const res = await http()
      .get(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(sat));
    expect(res.status).toBe(403);
  });

  it('faculty sees only their own entries on batch listing', async () => {
    const { at, faculty, course, batch } = await scaffold();
    const { user: otherFaculty } = await makeFaculty();
    // Add both faculties to course so entries can reference either.
    course.facultyIds.push(otherFaculty._id);
    await course.save();
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
    });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: otherFaculty._id,
      dayOfWeek: 2,
    });
    // faculty token is the first faculty's token from scaffold.
    const facultyAt = await tokenFor(faculty);
    const res = await http()
      .get(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(facultyAt));
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);

    // And the admin sees both.
    const adminRes = await http()
      .get(`/v1/batches/${batch._id.toString()}/timetable`)
      .set(bearer(at));
    expect(adminRes.body.data.entries).toHaveLength(2);
  });
});
