import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeOverdueStudent,
  makeProgram,
} from '../helpers/factories.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';
import { User } from '../../src/models/index.js';

describe('POST /v1/jobs/autosuspend', () => {
  useMongo();
  useIntegrationSpies();

  it('suspends a student whose installment is T+28 overdue', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { signature, timestamp } = signJobRequest({});
    const res = await http()
      .post('/v1/jobs/autosuspend')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.suspended).toBe(1);
    const reloaded = await User.findById(student._id);
    expect(reloaded?.status).toBe('suspended');
    expect(reloaded?.suspensionKind).toBe('fees');
  });

  it('fees-suspended student cannot hit course endpoints but can view fees', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { signature, timestamp } = signJobRequest({});
    await http()
      .post('/v1/jobs/autosuspend')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});

    const reloaded = await User.findById(student._id);
    const at = await tokenFor(reloaded!);

    // Blocked: generic course listing.
    const blocked = await http().get('/v1/me/courses').set(bearer(at));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('FEES_SUSPENDED');

    // Allowed: fees page.
    const allowed = await http().get('/v1/students/me/fees').set(bearer(at));
    expect(allowed.status).toBe(200);
  });

  it('admin override lifts suspension and allows course access again', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { signature, timestamp } = signJobRequest({});
    await http()
      .post('/v1/jobs/autosuspend')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});

    const { user: admin } = await makeAdmin();
    const adminAt = await tokenFor(admin);
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const override = await http()
      .post(`/v1/users/${String(student._id)}/suspension/override`)
      .set(bearer(adminAt))
      .send({ until, reason: 'Finance waived pending reconciliation' });
    expect(override.status).toBe(200);

    const reloaded = await User.findById(student._id);
    const at = await tokenFor(reloaded!);
    const coursesAllowed = await http().get('/v1/me/courses').set(bearer(at));
    expect(coursesAllowed.status).toBe(200);
  });
});
