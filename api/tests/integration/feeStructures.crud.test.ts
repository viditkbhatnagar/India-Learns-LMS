import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeProgram, makeStudent, makeUser } from '../helpers/factories.js';

describe('POST /v1/fee-structures', () => {
  useMongo();
  useIntegrationSpies();

  it('admin can create + list + get + patch', async () => {
    const { user: admin } = await makeAdmin();
    const program = await makeProgram();
    const at = await tokenFor(admin);
    const create = await http()
      .post('/v1/fee-structures')
      .set(bearer(at))
      .send({
        programId: String(program._id),
        name: 'Aviation 2026',
        components: [
          {
            kind: 'registration',
            label: 'Reg',
            amountPaise: 1_000_000,
            cadence: 'one_time',
            dueRule: 'on_enrolment',
          },
          {
            kind: 'tuition',
            label: 'Tuition',
            amountPaise: 6_000_000,
            cadence: 'monthly_x',
            monthlyCount: 3,
            dueRule: 'on_enrolment',
          },
        ],
      });
    expect(create.status).toBe(201);
    const id = create.body.data.feeStructure.id as string;

    const list = await http().get('/v1/fee-structures').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const get = await http().get(`/v1/fee-structures/${id}`).set(bearer(at));
    expect(get.status).toBe(200);
    expect(get.body.data.feeStructure.components).toHaveLength(2);

    const patch = await http()
      .patch(`/v1/fee-structures/${id}`)
      .set(bearer(at))
      .send({ name: 'Aviation 2026 — v2' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.feeStructure.name).toBe('Aviation 2026 — v2');
  });

  it('student cannot create a fee structure (403)', async () => {
    const { user: student } = await makeStudent();
    const program = await makeProgram();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/fee-structures')
      .set(bearer(at))
      .send({
        programId: String(program._id),
        name: 'X',
        components: [
          {
            kind: 'registration',
            label: 'Reg',
            amountPaise: 100,
            cadence: 'one_time',
            dueRule: 'on_enrolment',
          },
        ],
      });
    expect(res.status).toBe(403);
  });

  it('finance can list but cannot create', async () => {
    const finance = await makeUser({ role: 'finance' });
    const program = await makeProgram();
    const at = await tokenFor(finance);
    const list = await http().get('/v1/fee-structures').set(bearer(at));
    expect(list.status).toBe(200);
    const create = await http()
      .post('/v1/fee-structures')
      .set(bearer(at))
      .send({
        programId: String(program._id),
        name: 'X',
        components: [
          {
            kind: 'registration',
            label: 'Reg',
            amountPaise: 100,
            cadence: 'one_time',
            dueRule: 'on_enrolment',
          },
        ],
      });
    expect(create.status).toBe(403);
  });

  it('rejects monthly_x without monthlyCount', async () => {
    const { user: admin } = await makeAdmin();
    const program = await makeProgram();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/fee-structures')
      .set(bearer(at))
      .send({
        programId: String(program._id),
        name: 'X',
        components: [
          {
            kind: 'tuition',
            label: 'Tuition',
            amountPaise: 100,
            cadence: 'monthly_x',
            dueRule: 'on_enrolment',
          },
        ],
      });
    expect(res.status).toBe(422);
  });
});
