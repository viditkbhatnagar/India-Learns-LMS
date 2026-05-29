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
} from '../helpers/factories.js';

describe('course glossary + reading list', () => {
  useMongo();
  useIntegrationSpies();

  it('admin sets glossary + reading list; trims and drops empty entries', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });

    const res = await http()
      .patch(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at))
      .send({
        glossary: [
          { term: '  Apron  ', definition: '  The aircraft parking area.  ' },
          { term: '', definition: 'no term — dropped' },
          { term: 'Jet bridge', definition: '' }, // no definition — dropped
        ],
        readingList: [
          { title: 'Airport Ops 101', author: 'J. Doe', url: 'https://x.test/a', note: 'ch.1' },
          { title: '', author: 'nobody' }, // no title — dropped
        ],
      });

    expect(res.status).toBe(200);
    const c = res.body.data.course;
    expect(c.glossary).toEqual([{ term: 'Apron', definition: 'The aircraft parking area.' }]);
    expect(c.readingList).toEqual([
      { title: 'Airport Ops 101', author: 'J. Doe', url: 'https://x.test/a', note: 'ch.1' },
    ]);
  });

  it('faculty on the roster can edit glossary + reading list', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [fac._id] });

    const res = await http()
      .patch(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at))
      .send({ glossary: [{ term: 'PNR', definition: 'Passenger Name Record.' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.course.glossary).toEqual([
      { term: 'PNR', definition: 'Passenger Name Record.' },
    ]);
  });

  it('faculty NOT on the roster is 403', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [] });

    const res = await http()
      .patch(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at))
      .send({ readingList: [{ title: 'X' }] });

    expect(res.status).toBe(403);
  });

  it('new courses default to empty glossary + reading list', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });

    const res = await http()
      .get(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at));

    expect(res.status).toBe(200);
    expect(res.body.data.course.glossary).toEqual([]);
    expect(res.body.data.course.readingList).toEqual([]);
  });
});
