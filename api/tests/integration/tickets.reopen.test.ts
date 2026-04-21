import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeStudent,
  makeTicket,
  makeFaculty,
} from '../helpers/factories.js';
import { resetClock, setTestNow } from '../../src/services/clockService.js';

describe('ticket reopen flows', () => {
  useMongo();
  useIntegrationSpies();

  afterEach(() => resetClock());

  it('staff reopens a ticket at day 6 (within window)', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const closedAt = new Date();
    const t = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt,
      resolvedAt: closedAt,
      assigneeUserId: admin._id,
    });
    setTestNow(new Date(closedAt.getTime() + 6 * 86_400_000));
    const at = await tokenFor(admin);
    const res = await http()
      .post(`/v1/tickets/${t._id}/reopen`)
      .set(bearer(at))
      .send({ note: 'more info needed' });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.state).toBe('in_progress');
    expect(res.body.data.ticket.reopenedAt).toBeTruthy();
  });

  it('staff reopen at day 8 returns REOPEN_WINDOW_EXPIRED (409)', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const closedAt = new Date();
    const t = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt,
      resolvedAt: closedAt,
    });
    setTestNow(new Date(closedAt.getTime() + 8 * 86_400_000));
    const at = await tokenFor(admin);
    const res = await http()
      .post(`/v1/tickets/${t._id}/reopen`)
      .set(bearer(at))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REOPEN_WINDOW_EXPIRED');
  });

  it('student reopen-request creates a child ticket', async () => {
    const { user: student } = await makeStudent();
    const { user: faculty } = await makeFaculty();
    faculty.isCourseCoordinator = true;
    await faculty.save();
    const parent = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
      subject: 'Original',
    });
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/tickets/${parent._id}/reopen-request`)
      .set(bearer(at))
      .send({ reason: 'Still broken' });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.parentTicketId).toBe(String(parent._id));
    expect(res.body.data.ticket.subject.startsWith('Re: ')).toBe(true);
  });

  it('student cannot hit /reopen directly (403)', async () => {
    const { user: student } = await makeStudent();
    const t = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
    });
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/tickets/${t._id}/reopen`)
      .set(bearer(at))
      .send({});
    expect(res.status).toBe(403);
  });
});
