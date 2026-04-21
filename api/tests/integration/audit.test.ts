import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeAdmin } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { AuditLog } from '../../src/models/index.js';

describe('audit log', () => {
  useMongo();
  useIntegrationSpies();

  it('records successful login + user.created + user.suspended with scrubbed snapshots', async () => {
    const { user: admin, password } = await makeAdmin();
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: admin.email, password, deviceId: 'dev' });
    const token = login.body.data.accessToken;

    const created = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${token}`)
      .send({
        role: 'student',
        name: 'Tracked',
        email: 'tracked@example.com',
        phoneE164: '+919999200000',
      });
    const userId = created.body.data.user.id;

    await http()
      .post(`/v1/users/${userId}/suspend`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'test' });

    const loginLog = await AuditLog.findOne({ action: 'auth.login.success' });
    expect(loginLog).not.toBeNull();
    expect(loginLog!.actorUserId!.toString()).toBe(admin._id.toString());

    const createLog = await AuditLog.findOne({ action: 'user.created' });
    expect(createLog).not.toBeNull();
    const after = createLog!.after as Record<string, unknown>;
    expect(after.email).toBe('tracked@example.com');
    expect(after.passwordHash).toBeUndefined();
    expect(after.passwordHistoryHashes).toBeUndefined();

    const suspendLog = await AuditLog.findOne({ action: 'user.suspended' });
    expect(suspendLog).not.toBeNull();
    expect(suspendLog!.before).toMatchObject({ status: 'pending' });
    expect(suspendLog!.after).toMatchObject({ status: 'suspended', suspensionKind: 'manual' });
  });

  it('records failed login attempts with reason metadata', async () => {
    const { user } = await makeAdmin();
    await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'wrong', deviceId: 'dev' });
    const failLog = await AuditLog.findOne({ action: 'auth.login.failure' });
    expect(failLog).not.toBeNull();
    const details = failLog!.details as Record<string, unknown>;
    expect(details.reason).toBe('bad_password');
  });
});
