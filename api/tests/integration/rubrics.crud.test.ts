import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeCourse,
  makeFaculty,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';

describe('rubrics routes', () => {
  useMongo();
  useIntegrationSpies();

  it('faculty CRUD on rubric for their own course', async () => {
    const { user: faculty } = await makeFaculty();
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const at = await tokenFor(faculty);

    const create = await http()
      .post('/v1/rubrics')
      .set(bearer(at))
      .send({
        courseId: String(course._id),
        name: 'Default rubric',
        criteria: [
          { label: 'Clarity', kind: 'numeric', maxScore: 10 },
          {
            label: 'Quality',
            kind: 'scale',
            scale: ['Developing', 'Competent', 'Proficient', 'Exemplary'],
          },
        ],
      });
    expect(create.status).toBe(201);
    const id = create.body.data.rubric.id;

    const patch = await http()
      .patch(`/v1/rubrics/${id}`)
      .set(bearer(at))
      .send({ name: 'Updated' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.rubric.name).toBe('Updated');

    const list = await http().get('/v1/rubrics').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.rubrics.length).toBe(1);
  });

  it('other faculty cannot create rubric for a course they do not own', async () => {
    const { user: owner } = await makeFaculty();
    const { user: intruder } = await makeFaculty();
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [owner._id],
    });
    const at = await tokenFor(intruder);
    const res = await http()
      .post('/v1/rubrics')
      .set(bearer(at))
      .send({
        courseId: String(course._id),
        name: 'Hijack',
        criteria: [{ label: 'Clarity', kind: 'numeric', maxScore: 5 }],
      });
    expect(res.status).toBe(403);
  });

  it('rejects scale criterion with fewer than 2 levels (422)', async () => {
    const { user: faculty } = await makeFaculty();
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const at = await tokenFor(faculty);
    const res = await http()
      .post('/v1/rubrics')
      .set(bearer(at))
      .send({
        courseId: String(course._id),
        name: 'Bad',
        criteria: [
          { label: 'Oops', kind: 'scale', scale: ['Only one'] },
        ],
      });
    expect(res.status).toBe(422);
  });

  it('students cannot list rubrics (403)', async () => {
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http().get('/v1/rubrics').set(bearer(at));
    expect(res.status).toBe(403);
  });
});
