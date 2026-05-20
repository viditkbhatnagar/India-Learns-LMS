import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeFaculty, makeStudent } from '../helpers/factories.js';

describe('Staff attendance', () => {
  useMongo();
  useIntegrationSpies();

  it('faculty self-marks present and the row appears in admin list', async () => {
    const { user: admin } = await makeAdmin();
    const { user: fac } = await makeFaculty();
    const facAt = await tokenFor(fac);
    const adminAt = await tokenFor(admin);

    const mark = await http()
      .post('/v1/staff-attendance')
      .set(bearer(facAt))
      .send({ status: 'present' });
    expect(mark.status).toBe(201);
    expect(mark.body.data.attendance.status).toBe('present');
    expect(mark.body.data.attendance.userName).toBe(fac.name);

    const me = await http().get('/v1/staff-attendance/me/today').set(bearer(facAt));
    expect(me.status).toBe(200);
    expect(me.body.data.attendance?.status).toBe('present');

    const list = await http().get('/v1/staff-attendance').set(bearer(adminAt));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.items[0].status).toBe('present');
  });

  it('re-marking same day is an upsert (no duplicate row)', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const first = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ status: 'present' });
    expect(first.status).toBe(201);
    const second = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ status: 'late', notes: 'caught a flat tyre' });
    expect(second.status).toBe(201);
    expect(second.body.data.attendance.status).toBe('late');
    expect(second.body.data.attendance.notes).toBe('caught a flat tyre');
    // Same _id (upsert) → ensure list returns just one row.
    const { user: admin } = await makeAdmin();
    const adminAt = await tokenFor(admin);
    const list = await http().get('/v1/staff-attendance').set(bearer(adminAt));
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.items[0].id).toBe(first.body.data.attendance.id);
  });

  it('faculty cannot mark on behalf of someone else (403)', async () => {
    const { user: a } = await makeFaculty();
    const { user: b } = await makeFaculty();
    const at = await tokenFor(a);
    const res = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ userId: String(b._id), status: 'present' });
    expect(res.status).toBe(403);
  });

  it('admin can mark on behalf', async () => {
    const { user: admin } = await makeAdmin();
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ userId: String(fac._id), status: 'leave', notes: 'family wedding' });
    expect(res.status).toBe(201);
    expect(res.body.data.attendance.status).toBe('leave');
  });

  it('student is 403 on the staff-attendance endpoints', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const post = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ status: 'present' });
    expect(post.status).toBe(403);
    const list = await http().get('/v1/staff-attendance').set(bearer(at));
    expect(list.status).toBe(403);
  });

  it('admin trying to mark a student gets 422 NOT_STAFF', async () => {
    const { user: admin } = await makeAdmin();
    const { user: stu } = await makeStudent();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/staff-attendance')
      .set(bearer(at))
      .send({ userId: String(stu._id), status: 'present' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_STAFF');
  });
});

describe('POST /v1/public/visitor/register', () => {
  useMongo();
  useIntegrationSpies();

  it('creates a lead with otpVerificationStatus pinned to "pending"', async () => {
    const res = await http()
      .post('/v1/public/visitor/register')
      .send({
        firstName: 'Public',
        lastName: 'Lead',
        phoneE164: '+919812340001',
        leadSource: 'meta',
        socialMediaId: '@public',
        otpVerificationStatus: 'verified', // attempt to override — server should ignore
      } as never);
    expect(res.status).toBe(201);
    expect(res.body.data.lead.otpVerificationStatus).toBe('pending');
    expect(res.body.data.lead.status).toBe('new');
    expect(res.body.data.lead.firstName).toBe('Public');
  });

  it('rejects invalid phone with 422', async () => {
    const res = await http()
      .post('/v1/public/visitor/register')
      .send({
        firstName: 'X',
        lastName: 'Y',
        phoneE164: '12345',
        leadSource: 'meta',
      });
    expect(res.status).toBe(422);
  });
});
