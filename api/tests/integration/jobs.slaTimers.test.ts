import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import {
  makeAdmin,
  makeStudent,
  makeTicket,
} from '../helpers/factories.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';
import { resetClock, setTestNow } from '../../src/services/clockService.js';
import { Ticket } from '../../src/models/index.js';

describe('POST /v1/jobs/sla-timers', () => {
  useMongo();
  useIntegrationSpies();

  afterEach(() => resetClock());

  it('rejects unsigned request (401)', async () => {
    const res = await http().post('/v1/jobs/sla-timers').send({});
    expect(res.status).toBe(401);
  });

  it('flips breach flags, notifies, and is idempotent on a second run', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    const t = await makeTicket({
      studentId: student._id,
      assigneeUserId: admin._id,
      state: 'assigned',
      slaAckDeadline: new Date(now.getTime() - 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() + 5 * 86_400_000),
    });

    const { signature, timestamp } = signJobRequest({});
    const res = await http()
      .post('/v1/jobs/sla-timers')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.ackBreached).toBe(1);
    expect(res.body.data.resolveBreached).toBe(0);

    const refetched = await Ticket.findById(t._id);
    expect(refetched?.slaAckBreached).toBe(true);

    const { signature: s2, timestamp: t2 } = signJobRequest({});
    const res2 = await http()
      .post('/v1/jobs/sla-timers')
      .set('x-job-signature', s2)
      .set('x-job-timestamp', t2)
      .send({});
    expect(res2.status).toBe(200);
    expect(res2.body.data.ackBreached).toBe(0);
  });

  it('flips resolve breach separately from ack', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    await makeTicket({
      studentId: student._id,
      assigneeUserId: admin._id,
      state: 'in_progress',
      firstAckAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      slaAckDeadline: new Date(now.getTime() + 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() - 60 * 60 * 1000),
    });
    const { signature, timestamp } = signJobRequest({});
    const res = await http()
      .post('/v1/jobs/sla-timers')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.resolveBreached).toBe(1);
    expect(res.body.data.ackBreached).toBe(0);
  });
});
