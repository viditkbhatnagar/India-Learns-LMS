import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeUser } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { Application, AuditLog, User } from '../../src/models/index.js';

describe('admissions M1 — signup + officer dashboard', () => {
  useMongo();
  useIntegrationSpies();

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password, deviceId: 'dev-test' });
    expect(res.status).toBe(200);
    return res.body.data.accessToken as string;
  }

  it('signs up an applicant → creates User + Application with APP-YYYY-NNNNN code', async () => {
    const res = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'asha@example.com',
        name: 'Asha R',
        phoneE164: '+919999000001',
        password: 'Welcome#12345',
        deviceId: 'dev-applicant',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.application.code).toMatch(/^APP-\d{4}-\d{5}$/);
    expect(res.body.data.application.state).toBe('draft');
    expect(res.body.data.application.applicantName).toBe('Asha R');
    expect(res.body.data.application.applicantEmail).toBe('asha@example.com');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.accessTokenExpiresIn).toBeGreaterThan(0);

    const apps = await Application.find({});
    expect(apps).toHaveLength(1);
    expect(String(apps[0]!.applicantUserId)).toBe(
      res.body.data.application.applicantUserId,
    );

    const audits = await AuditLog.find({
      action: 'admission.applicant.signed_up',
    });
    expect(audits).toHaveLength(1);
  });

  it('accepts a bare 10-digit phone and stores it as +91 E.164', async () => {
    const res = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'tendigit@example.com',
        name: 'Ten Digit',
        phoneE164: '9812345678', // no + / country code — what applicants type
        password: 'Welcome#12345',
        deviceId: 'dev-ten',
      });
    expect(res.status).toBe(201);
    const user = await User.findById(res.body.data.application.applicantUserId);
    expect(user?.phoneE164).toBe('+919812345678');
  });

  it('rejects duplicate email with USER_EXISTS', async () => {
    await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'dup@example.com',
        name: 'First',
        phoneE164: '+919999000002',
        password: 'Welcome#12345',
        deviceId: 'dev-a',
      });
    const second = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'dup@example.com',
        name: 'Second',
        phoneE164: '+919999000003',
        password: 'Welcome#12345',
        deviceId: 'dev-b',
      });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('USER_EXISTS');
  });

  it('rejects a weak password before any user is created', async () => {
    const res = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'weak@example.com',
        name: 'Weak Pw',
        phoneE164: '+919999000004',
        password: 'short',
        deviceId: 'dev-weak',
      });
    expect(res.status).toBe(422);
    const apps = await Application.find({});
    expect(apps).toHaveLength(0);
  });

  it('applicant can read their own application via /admissions/me/application', async () => {
    const signup = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'mine@example.com',
        name: 'Mine',
        phoneE164: '+919999000005',
        password: 'Welcome#12345',
        deviceId: 'dev-me',
      });
    const token = signup.body.data.accessToken;
    const res = await http()
      .get('/v1/admissions/me/application')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.application.applicantEmail).toBe('mine@example.com');
  });

  it('officer can list all applications', async () => {
    await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'a@example.com',
        name: 'A',
        phoneE164: '+919999000010',
        password: 'Welcome#12345',
        deviceId: 'dev-a',
      });
    await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'b@example.com',
        name: 'B',
        phoneE164: '+919999000011',
        password: 'Welcome#12345',
        deviceId: 'dev-b',
      });

    const officer = await makeUser({
      role: 'admissions_officer',
      password: 'Officer#12345',
      status: 'active',
    });
    const officerToken = await loginAs(officer.email, 'Officer#12345');

    const list = await http()
      .get('/v1/admissions/officer/applications')
      .set('authorization', `Bearer ${officerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(2);
    expect(list.body.data.items).toHaveLength(2);
    // Most-recent first (sort: createdAt desc).
    expect(list.body.data.items[0].applicantEmail).toBe('b@example.com');
  });

  it('officer search matches by email or code', async () => {
    const signup = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'searchme@example.com',
        name: 'Search Me',
        phoneE164: '+919999000020',
        password: 'Welcome#12345',
        deviceId: 'dev-search',
      });
    const code = signup.body.data.application.code;

    const officer = await makeUser({
      role: 'admissions_officer',
      password: 'Officer#12345',
      status: 'active',
    });
    const officerToken = await loginAs(officer.email, 'Officer#12345');

    const byEmail = await http()
      .get('/v1/admissions/officer/applications')
      .query({ q: 'searchme' })
      .set('authorization', `Bearer ${officerToken}`);
    expect(byEmail.body.data.total).toBe(1);

    const byCode = await http()
      .get('/v1/admissions/officer/applications')
      .query({ q: code })
      .set('authorization', `Bearer ${officerToken}`);
    expect(byCode.body.data.total).toBe(1);
  });

  it('blocks applicant from listing applications (officer endpoint)', async () => {
    const signup = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'guess@example.com',
        name: 'Guess',
        phoneE164: '+919999000030',
        password: 'Welcome#12345',
        deviceId: 'dev-guess',
      });
    const token = signup.body.data.accessToken;
    const res = await http()
      .get('/v1/admissions/officer/applications')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks applicant from probing student endpoints (URL guessing)', async () => {
    const signup = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'probe@example.com',
        name: 'Probe',
        phoneE164: '+919999000031',
        password: 'Welcome#12345',
        deviceId: 'dev-probe',
      });
    const token = signup.body.data.accessToken;

    const dashboard = await http()
      .get('/v1/students/me/dashboard')
      .set('authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(403);

    const fees = await http()
      .get('/v1/students/me/fees')
      .set('authorization', `Bearer ${token}`);
    expect(fees.status).toBe(403);

    const courses = await http()
      .get('/v1/me/courses')
      .set('authorization', `Bearer ${token}`);
    expect(courses.status).toBe(403);

    const certificates = await http()
      .get('/v1/me/certificates')
      .set('authorization', `Bearer ${token}`);
    expect(certificates.status).toBe(403);
  });

  it('admin can also see the officer dashboard list', async () => {
    await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: 'visible@example.com',
        name: 'Visible',
        phoneE164: '+919999000040',
        password: 'Welcome#12345',
        deviceId: 'dev-vis',
      });
    const admin = await makeUser({
      role: 'admin',
      password: 'Admin#12345',
      status: 'active',
    });
    const adminToken = await loginAs(admin.email, 'Admin#12345');
    const res = await http()
      .get('/v1/admissions/officer/applications')
      .set('authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
