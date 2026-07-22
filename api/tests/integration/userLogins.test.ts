import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeBatch, makeCourse, makeProgram, makeStudent } from '../helpers/factories.js';

interface CredRow {
  email: string;
  role: string;
  password: string | null;
}

describe('POST /v1/users (generate password) + credentials', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates a STUDENT with a generated password, enrols them, and they log in', async () => {
    const program = await makeProgram();
    await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);

    const res = await http()
      .post('/v1/users')
      .set(bearer(at))
      .send({
        role: 'student',
        name: 'Josmy Jaimon',
        email: 'josmy@luc.local',
        phoneE164: '9812345678', // bare 10-digit — should normalize
        programId: String(program._id),
        batchId: String(batch._id),
        generatePassword: true,
        enrol: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.status).toBe('active');
    expect(res.body.data.user.phoneE164).toBe('+919812345678');
    expect(res.body.data.enrolmentsCount).toBeGreaterThan(0);
    const pw = res.body.data.temporaryPassword as string;
    expect(pw).toBeTruthy();

    // The generated credentials actually work at login.
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'josmy@luc.local', password: pw, deviceId: 'd' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('student');
  });

  it('credentials list shows created logins with decrypted password + role filter', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const created = await http()
      .post('/v1/users')
      .set(bearer(at))
      .send({ role: 'faculty', name: 'T', email: 'tt@luc.local', phoneE164: '+919812340000', generatePassword: true });

    const list = await http().get('/v1/users/credentials').set(bearer(at));
    expect(list.status).toBe(200);
    const row = (list.body.data.items as CredRow[]).find((u) => u.email === 'tt@luc.local');
    expect(row?.password).toBe(created.body.data.temporaryPassword);
    expect(row?.role).toBe('faculty');

    const studentsOnly = await http().get('/v1/users/credentials?role=student').set(bearer(at));
    expect((studentsOnly.body.data.items as CredRow[]).every((u) => u.role === 'student')).toBe(true);
  });

  it('reset-password issues a new working password for a student/faculty', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const created = await http()
      .post('/v1/users')
      .set(bearer(at))
      .send({ role: 'faculty', name: 'A2', email: 'a2@luc.local', phoneE164: '+919812340001', generatePassword: true });
    const id = created.body.data.user.id as string;

    const reset = await http().post(`/v1/users/${id}/reset-password`).set(bearer(at)).send({});
    expect(reset.status).toBe(200);
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'a2@luc.local', password: reset.body.data.temporaryPassword, deviceId: 'd' });
    expect(login.status).toBe(200);
  });

  it('a plain admin CANNOT reset another admin (403 — no privilege escalation)', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const other = await http()
      .post('/v1/users')
      .set(bearer(at))
      .send({ role: 'admin', name: 'Adm', email: 'adm@luc.local', phoneE164: '+919812340009', generatePassword: true });
    // Admins get no IL code.
    expect(other.body.data.user.code).toBeNull();
    const reset = await http()
      .post(`/v1/users/${other.body.data.user.id}/reset-password`)
      .set(bearer(at))
      .send({});
    expect(reset.status).toBe(403);
  });

  it('non-admin cannot read the credentials table (403)', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    expect((await http().get('/v1/users/credentials').set(bearer(at))).status).toBe(403);
  });

  it('email invite path (no generatePassword) still creates a pending user', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/users')
      .set(bearer(at))
      .send({ role: 'faculty', name: 'Invite Me', email: 'invite@luc.local', phoneE164: '+919812340002' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.status).toBe('pending');
    expect(res.body.data.temporaryPassword).toBeUndefined();
  });
});
