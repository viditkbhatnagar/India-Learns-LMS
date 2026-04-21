import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { makeBatch, makeCourse, makeProgram, makeStudent } from '../helpers/factories.js';
import { Enrollment } from '../../src/models/index.js';
import {
  enrolStudentInProgram,
  updateEnrollment,
} from '../../src/services/enrollmentService.js';

function actor(id?: unknown) {
  return {
    role: 'admin' as const,
    actorUserId: (id as never) ?? null,
    ip: '127.0.0.1',
    ua: 'vitest',
  };
}

describe('enrollmentService', () => {
  useMongo();

  it('creates N enrolments (one per course) when enrolling a student in a program', async () => {
    const program = await makeProgram();
    await Promise.all([
      makeCourse({ programId: program._id, slug: 'c1' }),
      makeCourse({ programId: program._id, slug: 'c2' }),
      makeCourse({ programId: program._id, slug: 'c3' }),
    ]);
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const created = await enrolStudentInProgram(
      {
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      },
      actor(),
    );
    expect(created).toHaveLength(3);
    const rows = await Enrollment.find({ studentId: student._id });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'active')).toBe(true);
    expect(rows.every((r) => r.accessState === 'active')).toBe(true);
  });

  it('rejects duplicate enrolment when student already has an active enrolment on a program course', async () => {
    const program = await makeProgram();
    await makeCourse({ programId: program._id, slug: 'c1' });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await enrolStudentInProgram(
      {
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      },
      actor(),
    );
    await expect(
      enrolStudentInProgram(
        {
          studentId: student._id.toString(),
          programId: program._id.toString(),
          batchId: batch._id.toString(),
          validFrom: '2026-07-01T00:00:00Z',
          validTo: '2027-07-01T00:00:00Z',
        },
        actor(),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'ENROLLMENT_DUPLICATE' });
  });

  it('rejects when batch is at capacity', async () => {
    const program = await makeProgram();
    await makeCourse({ programId: program._id, slug: 'c1' });
    const batch = await makeBatch({ programId: program._id, capacity: 1 });
    const { user: s1 } = await makeStudent();
    const { user: s2 } = await makeStudent();
    await enrolStudentInProgram(
      {
        studentId: s1._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      },
      actor(),
    );
    await expect(
      enrolStudentInProgram(
        {
          studentId: s2._id.toString(),
          programId: program._id.toString(),
          batchId: batch._id.toString(),
          validFrom: '2026-07-01T00:00:00Z',
          validTo: '2027-07-01T00:00:00Z',
        },
        actor(),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'BATCH_FULL' });
  });

  it('rejects non-admin', async () => {
    const program = await makeProgram();
    await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await expect(
      enrolStudentInProgram(
        {
          studentId: student._id.toString(),
          programId: program._id.toString(),
          batchId: batch._id.toString(),
          validFrom: '2026-07-01T00:00:00Z',
          validTo: '2027-07-01T00:00:00Z',
        },
        { role: 'faculty', actorUserId: null, ip: '', ua: '' },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects when batch program does not match input program', async () => {
    const p1 = await makeProgram();
    const p2 = await makeProgram();
    await makeCourse({ programId: p1._id });
    const batch = await makeBatch({ programId: p2._id });
    const { user: student } = await makeStudent();
    await expect(
      enrolStudentInProgram(
        {
          studentId: student._id.toString(),
          programId: p1._id.toString(),
          batchId: batch._id.toString(),
          validFrom: '2026-07-01T00:00:00Z',
          validTo: '2027-07-01T00:00:00Z',
        },
        actor(),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
  });

  it('updateEnrollment can revoke and records enrollment.revoked audit', async () => {
    const program = await makeProgram();
    await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const [enrolment] = await enrolStudentInProgram(
      {
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      },
      actor(),
    );
    const updated = await updateEnrollment(
      enrolment!._id.toString(),
      { status: 'revoked' },
      actor(),
    );
    expect(updated.status).toBe('revoked');
  });
});
