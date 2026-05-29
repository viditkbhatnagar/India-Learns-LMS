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
  makeModule,
  makeProgram,
} from '../helpers/factories.js';

describe('module glossary + reading list', () => {
  useMongo();
  useIntegrationSpies();

  it('admin sets module glossary + reading list; trims + drops empties', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({
        glossary: [
          { term: '  Gate  ', definition: '  Boarding point.  ' },
          { term: 'x', definition: '' },
        ],
        readingList: [
          { title: 'IATA Handbook', author: 'IATA', url: 'https://x.test', note: 'p.10' },
          { title: '' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.module.glossary).toEqual([
      { term: 'Gate', definition: 'Boarding point.' },
    ]);
    expect(res.body.data.module.readingList).toEqual([
      { title: 'IATA Handbook', author: 'IATA', url: 'https://x.test', note: 'p.10' },
    ]);
  });

  it('faculty on the course can edit module glossary', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [fac._id] });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ glossary: [{ term: 'ETA', definition: 'Estimated time of arrival.' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.module.glossary).toEqual([
      { term: 'ETA', definition: 'Estimated time of arrival.' },
    ]);
  });

  it('new modules default to empty glossary + reading list', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.module.glossary).toEqual([]);
    expect(res.body.data.module.readingList).toEqual([]);
  });
});
