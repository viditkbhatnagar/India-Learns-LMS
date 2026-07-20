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
} from '../helpers/factories.js';

describe('GET /v1/courses/:id/students', () => {
  useMongo();
  useIntegrationSpies();

  it('assigned faculty + admin see the roster; unassigned faculty + students are 403', async () => {
    const program = await makeProgram();
    const batch = await makeBatch({ programId: program._id });
    const { user: faculty } = await makeFaculty();
    const { user: otherFaculty } = await makeFaculty();
    const course = await makeCourse({ programId: program._id, facultyIds: [faculty._id] });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });

    const { user: admin } = await makeAdmin();
    const adminRes = await http()
      .get(`/v1/courses/${course._id}/students`)
      .set(bearer(await tokenFor(admin)));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.items).toHaveLength(1);
    expect(adminRes.body.data.items[0].studentId).toBe(String(student._id));

    const facRes = await http()
      .get(`/v1/courses/${course._id}/students`)
      .set(bearer(await tokenFor(faculty)));
    expect(facRes.status).toBe(200);
    expect(facRes.body.data.items).toHaveLength(1);

    const otherRes = await http()
      .get(`/v1/courses/${course._id}/students`)
      .set(bearer(await tokenFor(otherFaculty)));
    expect(otherRes.status).toBe(403);

    const stuRes = await http()
      .get(`/v1/courses/${course._id}/students`)
      .set(bearer(await tokenFor(student)));
    expect(stuRes.status).toBe(403);
  });
});
