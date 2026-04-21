import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeCourse,
  makeFaculty,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';

describe('POST /v1/storage/upload-url', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('admin gets a stub upload ticket', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({ folder: 'course-pdfs', filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.provider).toBe('stub');
    expect(res.body.data.ticket.url).toMatch(/^https:\/\/spy\.test\/upload\//);
    expect(spies.storage.tickets.length).toBe(1);
  });

  it('faculty can request a ticket for a course they are assigned to', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [fac._id],
    });
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({
        folder: 'course-videos',
        filename: 'v.mp4',
        contentType: 'video/mp4',
        courseId: course._id.toString(),
      });
    expect(res.status).toBe(200);
  });

  it('faculty 403 for an unassigned course', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [],
    });
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({
        folder: 'course-videos',
        filename: 'v.mp4',
        contentType: 'video/mp4',
        courseId: course._id.toString(),
      });
    expect(res.status).toBe(403);
  });

  it('faculty 422 when courseId is missing', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({ folder: 'course-pdfs', filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(422);
  });

  it('faculty 403 on non-course folder (e.g. receipts)', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [fac._id],
    });
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({
        folder: 'receipts',
        filename: 'r.pdf',
        contentType: 'application/pdf',
        courseId: course._id.toString(),
      });
    expect(res.status).toBe(403);
  });

  it('student 403', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http()
      .post('/v1/storage/upload-url')
      .set(bearer(at))
      .send({ folder: 'course-pdfs', filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });
});
