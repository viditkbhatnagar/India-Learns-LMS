import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeModule,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { AuditLog, Course, User } from '../../src/models/index.js';
import {
  assertStudentCanViewModule,
  recordModuleViewed,
} from '../../src/services/moduleAccessService.js';
import { HttpError } from '../../src/middleware/error.js';

describe('moduleAccessService.assertStudentCanViewModule', () => {
  useMongo();

  async function buildScene(overrides: {
    courseState?: 'sandbox' | 'published';
    validTo?: Date;
    enrolmentStatus?: 'active' | 'expired' | 'revoked';
    accessState?: 'active' | 'warn1' | 'warn2' | 'override' | 'suspended';
    programMismatch?: boolean;
  } = {}) {
    const program = await makeProgram();
    const otherProgram = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: overrides.courseState ?? 'published',
    });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const enrolment = await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: overrides.programMismatch ? otherProgram._id : program._id,
      validTo: overrides.validTo,
      status: overrides.enrolmentStatus ?? 'active',
      accessState: overrides.accessState ?? 'active',
    });
    const loaded = await User.findById(student._id);
    return { program, course, mod, batch, student: loaded!, enrolment };
  }

  it('returns context on happy path', async () => {
    const { student, mod, course, enrolment } = await buildScene();
    const ctx = await assertStudentCanViewModule(student, mod);
    expect(ctx.course._id.equals(course._id)).toBe(true);
    expect(ctx.enrolment._id.equals(enrolment._id)).toBe(true);
  });

  it('PR #14 — returns context if course is sandbox AND student is enrolled', async () => {
    // Enrolment is the access truth. Sandbox courses are reachable for
    // enrolled students (UAT round 2 — staging seeds enrolments against
    // sandbox courses spun up by curriculum import).
    const { student, mod, course, enrolment } = await buildScene({ courseState: 'sandbox' });
    const ctx = await assertStudentCanViewModule(student, mod);
    expect(ctx.course._id.equals(course._id)).toBe(true);
    expect(ctx.enrolment._id.equals(enrolment._id)).toBe(true);
  });

  it('returns 404 NOT_FOUND if course is sandbox AND student is not enrolled', async () => {
    const { student, mod, enrolment } = await buildScene({ courseState: 'sandbox' });
    enrolment.status = 'revoked';
    await enrolment.save();
    await expect(assertStudentCanViewModule(student, mod)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 NOT_FOUND if course is soft-deleted', async () => {
    const { student, mod, course } = await buildScene();
    course.deletedAt = new Date();
    await course.save();
    await expect(assertStudentCanViewModule(student, mod)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('returns 403 NOT_ENROLLED if no active enrolment', async () => {
    const { student, mod, enrolment } = await buildScene();
    enrolment.status = 'revoked';
    await enrolment.save();
    await expect(assertStudentCanViewModule(student, mod)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_ENROLLED',
    });
  });

  it('returns 403 FORBIDDEN on program mismatch', async () => {
    const { student, mod } = await buildScene({ programMismatch: true });
    await expect(assertStudentCanViewModule(student, mod)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('returns 403 ENROLMENT_EXPIRED when validTo is past and flips status', async () => {
    const past = new Date('2020-01-01T00:00:00Z');
    const { student, mod, enrolment } = await buildScene({ validTo: past });
    try {
      await assertStudentCanViewModule(student, mod);
      throw new Error('expected HttpError');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(403);
      expect((err as HttpError).code).toBe('ENROLMENT_EXPIRED');
    }
    const { Enrollment } = await import('../../src/models/index.js');
    const reloaded = await Enrollment.findById(enrolment._id);
    expect(reloaded!.status).toBe('expired');
  });

  it('returns 403 SUSPENDED_ACCESS when accessState is suspended', async () => {
    const { student, mod } = await buildScene({ accessState: 'suspended' });
    await expect(assertStudentCanViewModule(student, mod)).rejects.toMatchObject({
      status: 403,
      code: 'SUSPENDED_ACCESS',
    });
  });

  it('allows access when accessState is warn1, warn2, or override', async () => {
    for (const accessState of ['warn1', 'warn2', 'override'] as const) {
      const { student, mod } = await buildScene({ accessState });
      await expect(assertStudentCanViewModule(student, mod)).resolves.toBeDefined();
    }
  });

  it('recordModuleViewed writes an audit entry', async () => {
    const { student, mod } = await buildScene();
    const ctx = await assertStudentCanViewModule(student, mod);
    await recordModuleViewed(student, mod, ctx, { ip: '1.2.3.4', ua: 'ua' });
    const audit = await AuditLog.findOne({ action: 'module.viewed' });
    expect(audit).not.toBeNull();
    expect(audit!.targetId!.equals(mod._id)).toBe(true);
    expect((audit!.details as { courseId: string }).courseId).toBe(
      (await Course.findById(mod.courseId))!._id.toString(),
    );
  });
});
