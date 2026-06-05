import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeAdmin, makeUser } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { tokenFor } from '../helpers/auth.js';

async function loginAsAdmin(): Promise<string> {
  const { user, password } = await makeAdmin();
  const res = await http()
    .post('/v1/auth/login')
    .send({ email: user.email, password, deviceId: 'dev' });
  return res.body.data.accessToken as string;
}

describe('users CRUD', () => {
  useMongo();
  useIntegrationSpies();

  it('lists users with pagination + filters', async () => {
    const token = await loginAsAdmin();
    for (let i = 0; i < 3; i += 1) {
       
      await http()
        .post('/v1/users')
        .set('authorization', `Bearer ${token}`)
        .send({
          role: 'student',
          name: `Student ${i}`,
          email: `s${i}@example.com`,
          phoneE164: `+919999100${i}00`,
        });
    }

    const listed = await http()
      .get('/v1/users?role=student&limit=10')
      .set('authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.length).toBe(3);
    expect(listed.body.data.total).toBe(3);
  });

  it('updates name via PATCH and soft-deletes via DELETE', async () => {
    const token = await loginAsAdmin();
    const created = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${token}`)
      .send({
        role: 'faculty',
        name: 'Old Name',
        email: 'fac@example.com',
        phoneE164: '+919999000050',
      });
    const userId = created.body.data.user.id;

    const patched = await http()
      .patch(`/v1/users/${userId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.user.name).toBe('New Name');

    const deleted = await http()
      .delete(`/v1/users/${userId}`)
      .set('authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.user.status).toBe('revoked');
    expect(deleted.body.data.user.deletedAt).not.toBeNull();
    expect(deleted.body.data.user.email).toMatch(/^deleted\+/);
  });

  it('suspends + unsuspends a student', async () => {
    const token = await loginAsAdmin();
    const created = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${token}`)
      .send({
        role: 'student',
        name: 'Susan D',
        email: 'susan@example.com',
        phoneE164: '+919999000060',
      });
    const userId = created.body.data.user.id;

    const suspended = await http()
      .post(`/v1/users/${userId}/suspend`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Investigating infraction' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.user.status).toBe('suspended');
    expect(suspended.body.data.user.suspensionKind).toBe('manual');
    expect(suspended.body.data.user.suspensionReason).toBe('Investigating infraction');

    const unsuspended = await http()
      .post(`/v1/users/${userId}/unsuspend`)
      .set('authorization', `Bearer ${token}`);
    expect(unsuspended.status).toBe(200);
    expect(unsuspended.body.data.user.status).toBe('pending');
    expect(unsuspended.body.data.user.suspensionKind).toBeNull();
  });

  it('exposes GET /v1/users/me for the caller', async () => {
    const { user, password } = await makeAdmin();
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password, deviceId: 'dev' });
    const me = await http()
      .get('/v1/users/me')
      .set('authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);
    expect(me.body.data.user.passwordHash).toBeUndefined();
  });

  it('allows POST /v1/users from a superadmin (round-3 oversight policy)', async () => {
    const superadmin = await makeUser({
      role: 'superadmin',
      password: 'Super#12345',
      status: 'active',
    });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: superadmin.email, password: 'Super#12345', deviceId: 'dev' });
    const accessToken = login.body.data.accessToken;
    const attempt = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        role: 'student',
        name: 'Invited by SA',
        email: 'sa-invited@example.com',
        phoneE164: '+919999000100',
      });
    expect(attempt.status).toBe(201);
    expect(attempt.body.data.user.email).toBe('sa-invited@example.com');
  });

  it('M10v — POST /v1/users captures Section 1 fields when provided', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${at}`)
      .send({
        role: 'student',
        name: 'Full Section 1',
        email: 'fs1@example.com',
        phoneE164: '+919900001111',
        dateOfBirth: '2000-06-15',
        personalAddress: {
          street: '12 MG Road',
          city: 'Kochi',
          stateProvince: 'Kerala',
          postalCode: '682011',
          country: 'India',
        },
        emergencyContact: {
          name: 'Rita',
          relationship: 'Sister',
          phoneE164: '+919900002222',
          email: null,
        },
        parentGuardian: {
          name: 'Anil',
          relationship: 'Father',
          phoneE164: '+919900003333',
          email: 'anil@example.com',
        },
      });
    expect(res.status).toBe(201);
    const u = res.body.data.user;
    expect(u.dateOfBirth).toMatch(/^2000-06-15/);
    expect(u.personalAddress.city).toBe('Kochi');
    expect(u.personalAddress.country).toBe('India');
    expect(u.emergencyContact.name).toBe('Rita');
    expect(u.emergencyContact.email).toBeNull();
    expect(u.parentGuardian.email).toBe('anil@example.com');
  });

  it('M10v — POST /v1/users still works without Section 1 fields', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${at}`)
      .send({
        role: 'student',
        name: 'Bare bones',
        email: 'bare@example.com',
        phoneE164: '+919900004444',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user.dateOfBirth).toBeNull();
    expect(res.body.data.user.personalAddress).toBeNull();
    expect(res.body.data.user.emergencyContact).toBeNull();
    expect(res.body.data.user.parentGuardian).toBeNull();
  });

  it('blocks non-admins from admin mutations', async () => {
    const student = await makeUser({ password: 'Correct#12345' });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: student.email, password: 'Correct#12345', deviceId: 'dev' });
    const accessToken = login.body.data.accessToken;

    const listAttempt = await http()
      .get('/v1/users')
      .set('authorization', `Bearer ${accessToken}`);
    expect(listAttempt.status).toBe(403);

    const createAttempt = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        role: 'student',
        name: 'Mallory',
        email: 'mal@example.com',
        phoneE164: '+919999000070',
      });
    expect(createAttempt.status).toBe(403);
  });

  it('lets a student self-patch name but not role fields', async () => {
    const student = await makeUser({ password: 'Correct#12345' });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: student.email, password: 'Correct#12345', deviceId: 'dev' });
    const accessToken = login.body.data.accessToken;
    const patchName = await http()
      .patch(`/v1/users/${student._id.toString()}`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ name: 'Self Updated' });
    expect(patchName.status).toBe(200);
    expect(patchName.body.data.user.name).toBe('Self Updated');

    const patchBatch = await http()
      .patch(`/v1/users/${student._id.toString()}`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ batchId: '64b000000000000000000001' });
    expect(patchBatch.status).toBe(403);
  });

  it('normalises a phone typed with spaces to strict E.164 on invite', async () => {
    const token = await loginAsAdmin();
    const res = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${token}`)
      .send({
        role: 'faculty',
        name: 'Demariz',
        email: 'demariz.spaces@example.com',
        phoneE164: '+91 80899 30510', // spaces — exactly what Logan typed
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user.phoneE164).toBe('+918089930510');
  });

  it('rejects a malformed phone with a field-level error', async () => {
    const token = await loginAsAdmin();
    const res = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${token}`)
      .send({
        role: 'faculty',
        name: 'Bad Phone',
        email: 'bad.phone@example.com',
        phoneE164: 'not-a-number',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.fieldErrors.phoneE164?.length).toBeGreaterThan(0);
  });
});
