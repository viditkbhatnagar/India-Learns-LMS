import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeFaculty,
  makeStudent,
  makeTicket,
} from '../helpers/factories.js';
import { Ticket } from '../../src/models/index.js';

describe('POST /v1/tickets/:id/comments', () => {
  useMongo();
  useIntegrationSpies();

  it('staff public comment sets firstAckAt and nudges open → assigned', async () => {
    const { user: student } = await makeStudent();
    const { user: faculty } = await makeFaculty();
    const t = await makeTicket({
      studentId: student._id,
      state: 'open',
    });
    const at = await tokenFor(faculty);
    const res = await http()
      .post(`/v1/tickets/${t._id}/comments`)
      .set(bearer(at))
      .send({ body: 'on it' });
    expect(res.status).toBe(201);
    expect(res.body.data.comment.visibility).toBe('public');
    const fresh = await Ticket.findById(t._id);
    expect(fresh?.firstAckAt).toBeTruthy();
    expect(fresh?.state).toBe('assigned');
  });

  it('student cannot comment on a resolved ticket (409)', async () => {
    const { user: student } = await makeStudent();
    const t = await makeTicket({
      studentId: student._id,
      state: 'resolved',
      resolvedAt: new Date(),
    });
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/tickets/${t._id}/comments`)
      .set(bearer(at))
      .send({ body: 'please reopen' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TICKET_STATE_INVALID');
  });

  it('student comment visibility is forced to public', async () => {
    const { user: student } = await makeStudent();
    const t = await makeTicket({
      studentId: student._id,
      state: 'in_progress',
    });
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/tickets/${t._id}/comments`)
      .set(bearer(at))
      .send({ body: 'update?', visibility: 'internal' });
    expect(res.status).toBe(201);
    expect(res.body.data.comment.visibility).toBe('public');
  });

  it('student sees only public comments in ticket detail', async () => {
    const { user: student } = await makeStudent();
    const { user: faculty } = await makeFaculty();
    const t = await makeTicket({
      studentId: student._id,
      state: 'in_progress',
      assigneeUserId: faculty._id,
    });
    const facultyToken = await tokenFor(faculty);
    await http()
      .post(`/v1/tickets/${t._id}/comments`)
      .set(bearer(facultyToken))
      .send({ body: 'internal note', visibility: 'internal' });
    await http()
      .post(`/v1/tickets/${t._id}/comments`)
      .set(bearer(facultyToken))
      .send({ body: 'public reply', visibility: 'public' });

    const studentToken = await tokenFor(student);
    const detail = await http()
      .get(`/v1/tickets/${t._id}`)
      .set(bearer(studentToken));
    expect(detail.status).toBe(200);
    const bodies = detail.body.data.comments.map((c: { body: string }) => c.body);
    expect(bodies).toContain('public reply');
    expect(bodies).not.toContain('internal note');
  });
});
