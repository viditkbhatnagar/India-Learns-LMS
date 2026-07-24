import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeProgram, makeStudent, makeUser } from '../helpers/factories.js';
import { ModuleModel, SessionModel } from '../../src/models/index.js';

describe('POST /v1/curriculum-import/lessons (ingest a lesson-plan document)', () => {
  useMongo();
  useIntegrationSpies();

  const body = (programId: string, extra: Record<string, unknown> = {}) => ({
    programId,
    name: 'Diploma in Digital Fashion Entrepreneurship',
    modules: [
      { title: 'M1 Foundations', lessons: [{ title: 'Lesson A' }, { title: 'Lesson B', plannedMinutes: 90 }] },
      { title: 'M2 Practice', lessons: [{ title: 'Lesson C' }] },
    ],
    ...extra,
  });

  it('creates a new sandbox course with the parsed modules + lessons', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa-${Date.now()}@x.com` });
    const at = await tokenFor(sa);

    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.modules).toBe(2);
    expect(res.body.data.lessons).toBe(3);

    const courseId = res.body.data.courseId;
    expect(await ModuleModel.countDocuments({ courseId })).toBe(2);
    const sessions = await SessionModel.find({ courseId });
    expect(sessions).toHaveLength(3);
    // manual lessons must survive a later generator re-import
    expect(sessions.every((s) => s.sourceLessonId === null && s.synthesized === false)).toBe(true);
  });

  it('replaces an existing course wholesale when courseId is given', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa2-${Date.now()}@x.com` });
    const at = await tokenFor(sa);

    const first = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    const courseId = first.body.data.courseId as string;

    const replaced = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(at))
      .send(
        body(String(program._id), {
          courseId,
          modules: [{ title: 'Only Module', lessons: [{ title: 'Solo lesson' }] }],
        }),
      );
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.created).toBe(false);
    expect(replaced.body.data.courseId).toBe(courseId); // same course
    expect(await SessionModel.countDocuments({ courseId })).toBe(1); // wiped 3 → 1
    expect(await ModuleModel.countDocuments({ courseId })).toBe(1);
  });

  it('is superadmin-only', async () => {
    const program = await makeProgram();
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(403);
  });
});
