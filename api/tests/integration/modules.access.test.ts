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
  makeModule,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { AuditLog } from '../../src/models/index.js';

describe('GET /v1/modules/:id — student access gate', () => {
  useMongo();
  useIntegrationSpies();

  async function scene(overrides: {
    state?: 'sandbox' | 'published';
    validTo?: Date;
    accessState?: 'active' | 'warn1' | 'warn2' | 'override' | 'suspended';
    skipEnrolment?: boolean;
  } = {}) {
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: overrides.state ?? 'published',
    });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    if (!overrides.skipEnrolment) {
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
        validTo: overrides.validTo,
        accessState: overrides.accessState ?? 'active',
      });
    }
    const at = await tokenFor(student);
    return { program, course, mod, student, at };
  }

  it('200 on happy path + writes module.viewed audit', async () => {
    const { mod, at } = await scene();
    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.module.id).toBe(mod._id.toString());
    const audit = await AuditLog.findOne({ action: 'module.viewed' });
    expect(audit).not.toBeNull();
    expect(audit!.targetId!.equals(mod._id)).toBe(true);
  });

  it('404 when course is sandbox', async () => {
    const { mod, at } = await scene({ state: 'sandbox' });
    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(404);
  });

  it('403 NOT_ENROLLED when student has no active enrolment', async () => {
    const { mod, at } = await scene({ skipEnrolment: true });
    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ENROLLED');
  });

  it('403 ENROLMENT_EXPIRED when validTo is in the past', async () => {
    const { mod, at } = await scene({ validTo: new Date('2020-01-01T00:00:00Z') });
    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENROLMENT_EXPIRED');
  });

  it('403 SUSPENDED_ACCESS when accessState is suspended', async () => {
    const { mod, at } = await scene({ accessState: 'suspended' });
    const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUSPENDED_ACCESS');
  });

  it('200 when accessState is warn1/warn2/override', async () => {
    for (const accessState of ['warn1', 'warn2', 'override'] as const) {
      const { mod, at } = await scene({ accessState });
      const res = await http().get(`/v1/modules/${mod._id.toString()}`).set(bearer(at));
      expect(res.status).toBe(200);
    }
  });
});
