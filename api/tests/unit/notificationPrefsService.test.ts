import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeStudent } from '../helpers/factories.js';
import {
  getOrCreatePrefsForUser,
  toNotificationPrefsDto,
  updatePrefsForUser,
} from '../../src/services/notificationPrefsService.js';
import { enqueueNotification } from '../../src/services/notificationService.js';
import { NotificationPrefs } from '../../src/models/index.js';

describe('notificationPrefsService', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('getOrCreatePrefsForUser seeds defaults on first call and reuses on second', async () => {
    const { user } = await makeStudent();
    const first = await getOrCreatePrefsForUser(user._id);
    const second = await getOrCreatePrefsForUser(user._id);
    expect(first._id.toString()).toBe(second._id.toString());
    const count = await NotificationPrefs.countDocuments({ userId: user._id });
    expect(count).toBe(1);

    const dto = toNotificationPrefsDto(first);
    // Email defaults on for every registered type.
    expect(dto.emailByType['timetable.change']).toBe(true);
    expect(dto.emailByType['certificate.issued']).toBe(true);
    // WhatsApp only on for the 3 approved templates.
    expect(dto.whatsappByType['fees.due.today']).toBe(true);
    expect(dto.whatsappByType['ticket.state_changed']).toBe(true);
    expect(dto.whatsappByType['timetable.change']).toBe(false);
    expect(dto.whatsappByType['certificate.issued']).toBe(false);
  });

  it('updatePrefsForUser rejects WhatsApp=true on non-templated type with VALIDATION_FAILED', async () => {
    const { user } = await makeStudent();
    await expect(
      updatePrefsForUser({
        userId: user._id,
        whatsappByType: { 'certificate.issued': true },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });
  });

  it('updatePrefsForUser rejects unknown notification type', async () => {
    const { user } = await makeStudent();
    await expect(
      updatePrefsForUser({
        userId: user._id,
        emailByType: { 'not.a.real.type': false },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });
  });

  it('prefs enforcement: email=false for a type suppresses email dispatch', async () => {
    const { user: student } = await makeStudent();
    await updatePrefsForUser({
      userId: student._id,
      emailByType: { 'timetable.change': false },
    });
    await enqueueNotification({
      type: 'timetable.change',
      recipients: [student._id],
      title: 'Schedule change',
      body: 'Body',
    });
    expect(spies.email.calls).toHaveLength(0);
  });
});
