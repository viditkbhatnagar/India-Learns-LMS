import type { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { makeAdmin, makeStudent, makeUser } from '../helpers/factories.js';
import { User } from '../../src/models/index.js';
import { verifyPassword } from '../../src/services/passwordService.js';
import {
  createUserAccount,
  listCredentialedUsers,
  resetUserPassword,
} from '../../src/services/userAccountService.js';

function adminActor(id: Types.ObjectId) {
  return { role: 'admin' as const, actorUserId: id, ip: '', ua: '' };
}

describe('userAccountService', () => {
  useMongo();

  it('creates an active login for any provisionable role; codes only for student/faculty', async () => {
    const { user: admin } = await makeAdmin();
    const student = await createUserAccount(
      { role: 'student', name: 'S', email: 's@x.com', phoneE164: '+919812345670' },
      adminActor(admin._id),
    );
    expect(student.user.role).toBe('student');
    expect(student.user.status).toBe('active');
    expect(student.user.code).toMatch(/^IL-\d{4}-\d{4}$/);
    const fresh = await User.findById(student.user._id);
    expect(await verifyPassword(fresh!.passwordHash, student.temporaryPassword)).toBe(true);

    const adminAcc = await createUserAccount(
      { role: 'admin', name: 'A', email: 'a@x.com', phoneE164: '+919812345671' },
      adminActor(admin._id),
    );
    expect(adminAcc.user.code).toBeNull(); // admins get no IL code
  });

  it('rejects applicant provisioning and non-admin actors', async () => {
    const { user: admin } = await makeAdmin();
    await expect(
      createUserAccount(
        { role: 'applicant', name: 'X', email: 'x@x.com', phoneE164: '+919812345672' },
        adminActor(admin._id),
      ),
    ).rejects.toThrow(/cannot create/i);

    const { user: stu } = await makeStudent();
    await expect(
      createUserAccount(
        { role: 'student', name: 'Y', email: 'y@x.com', phoneE164: '+919812345673' },
        { role: 'student', actorUserId: stu._id, ip: '', ua: '' },
      ),
    ).rejects.toThrow(/only admins/i);
  });

  it('lists only users that have a stored credential; reset creates one for any user', async () => {
    const { user: admin } = await makeAdmin();
    const acc = await createUserAccount(
      { role: 'faculty', name: 'F', email: 'f@x.com', phoneE164: '+919812345674' },
      adminActor(admin._id),
    );
    // A plain student with no generated credential must NOT appear.
    const { user: plain } = await makeStudent();

    let list = await listCredentialedUsers(adminActor(admin._id));
    expect(list.some((u) => u.id === String(acc.user._id))).toBe(true);
    expect(list.some((u) => u.id === String(plain._id))).toBe(false);
    expect(list.find((u) => u.id === String(acc.user._id))?.password).toBe(acc.temporaryPassword);

    // Reset gives the plain user a (now stored) password → shows up afterwards.
    const { temporaryPassword } = await resetUserPassword(String(plain._id), adminActor(admin._id));
    const fresh = await User.findById(plain._id);
    expect(await verifyPassword(fresh!.passwordHash, temporaryPassword)).toBe(true);
    list = await listCredentialedUsers(adminActor(admin._id));
    expect(list.find((u) => u.id === String(plain._id))?.password).toBe(temporaryPassword);
  });

  it('reset-password cannot escalate: admin cannot reset a superadmin or (as non-superadmin) another admin', async () => {
    const { user: admin } = await makeAdmin();
    const superadmin = await makeUser({ role: 'superadmin', email: `sa-${Date.now()}@x.com` });
    // Admin cannot reset a superadmin (would be account takeover).
    await expect(resetUserPassword(String(superadmin._id), adminActor(admin._id))).rejects.toThrow(
      /cannot be reset/i,
    );
    // A plain admin cannot reset another admin.
    const { user: otherAdmin } = await makeAdmin();
    await expect(resetUserPassword(String(otherAdmin._id), adminActor(admin._id))).rejects.toThrow(
      /superadmin/i,
    );
    // A superadmin CAN reset an admin.
    const saActor = { role: 'superadmin' as const, actorUserId: superadmin._id, ip: '', ua: '' };
    const { temporaryPassword } = await resetUserPassword(String(otherAdmin._id), saActor);
    expect(temporaryPassword).toBeTruthy();
  });

  it('credentials table hides superadmin always + admin from non-superadmins', async () => {
    const { user: admin } = await makeAdmin();
    const adminAcc = await createUserAccount(
      { role: 'admin', name: 'AA', email: 'aa@x.com', phoneE164: '+919812345690' },
      adminActor(admin._id),
    );
    const asAdmin = await listCredentialedUsers(adminActor(admin._id));
    expect(asAdmin.some((u) => u.id === String(adminAcc.user._id))).toBe(false);

    const superadmin = await makeUser({ role: 'superadmin', email: `sa2-${Date.now()}@x.com` });
    const asSuper = await listCredentialedUsers({
      role: 'superadmin',
      actorUserId: superadmin._id,
      ip: '',
      ua: '',
    });
    expect(asSuper.some((u) => u.id === String(adminAcc.user._id))).toBe(true);
  });
});
