import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeStudent,
  makeTicket,
} from '../helpers/factories.js';

describe('POST /v1/tickets/:id/state', () => {
  useMongo();
  useIntegrationSpies();

  it('rejects illegal transitions (open → closed)', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const t = await makeTicket({ studentId: student._id, state: 'open' });
    const at = await tokenFor(admin);
    const res = await http()
      .post(`/v1/tickets/${t._id}/state`)
      .set(bearer(at))
      .send({ to: 'closed' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_STATE_INVALID');
  });

  it('POST /state works; PATCH /state is a valid alias', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    const t = await makeTicket({
      studentId: student._id,
      state: 'in_progress',
      assigneeUserId: admin._id,
    });
    const at = await tokenFor(admin);
    const post = await http()
      .post(`/v1/tickets/${t._id}/state`)
      .set(bearer(at))
      .send({ to: 'resolved', note: 'fixed' });
    expect(post.status).toBe(200);
    expect(post.body.data.ticket.state).toBe('resolved');

    const patch = await http()
      .patch(`/v1/tickets/${t._id}/state`)
      .set(bearer(at))
      .send({ to: 'closed' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.ticket.state).toBe('closed');
  });

  it('student cannot transition state (403)', async () => {
    const { user: student } = await makeStudent();
    const t = await makeTicket({ studentId: student._id });
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/tickets/${t._id}/state`)
      .set(bearer(at))
      .send({ to: 'in_progress' });
    expect(res.status).toBe(403);
  });
});
