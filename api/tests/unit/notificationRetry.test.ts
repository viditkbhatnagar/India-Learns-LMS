import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeStudent } from '../helpers/factories.js';
import {
  enqueueNotification,
  retryFailedNotifications,
} from '../../src/services/notificationService.js';
import { Notification } from '../../src/models/index.js';

describe('notificationService retry sweep', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('retries failed email sends up to maxAttempts with exponential backoff', async () => {
    const { user: student } = await makeStudent();
    const originalSend = spies.email.send.bind(spies.email);
    spies.email.send = async () => {
      throw new Error('transient 503');
    };
    try {
      await enqueueNotification({
        type: 'timetable.change',
        recipients: [student._id],
        title: 'Change',
        body: 'Body',
      });
    } finally {
      spies.email.send = originalSend;
    }
    const doc = await Notification.findOne({});
    expect(doc?.emailError).toContain('transient 503');
    expect(doc?.emailSentAt).toBeNull();

    // First retry — attempt 1; backoff requires ≥ 2^0 * 60s from lastRetryAt.
    // Since lastRetryAt is null, the retry fires immediately.
    let run = await retryFailedNotifications({
      now: new Date(),
      maxAttempts: 3,
      windowHours: 24,
    });
    expect(run.processed).toBe(1);
    expect(run.succeeded).toBe(1);

    // Subsequent run finds nothing to retry (email sent successfully).
    run = await retryFailedNotifications({
      now: new Date(),
      maxAttempts: 3,
      windowHours: 24,
    });
    expect(run.processed).toBe(0);
  });

  it('skips retry if backoff window not elapsed', async () => {
    const { user: student } = await makeStudent();
    const originalSend = spies.email.send.bind(spies.email);
    spies.email.send = async () => {
      throw new Error('fail');
    };
    try {
      await enqueueNotification({
        type: 'timetable.change',
        recipients: [student._id],
        title: 'X',
        body: 'Y',
      });

      const now0 = new Date();
      // First sweep — should fire once (no lastRetryAt; backoff irrelevant).
      const r1 = await retryFailedNotifications({
        now: now0,
        maxAttempts: 3,
        windowHours: 24,
      });
      expect(r1.processed).toBe(1);
      expect(r1.failed).toBe(1);

      // Immediate second sweep — still within the backoff window (2^1 * 60s =
      // 120s needed for the next attempt), so it should be skipped.
      const r2 = await retryFailedNotifications({
        now: new Date(now0.getTime() + 30_000),
        maxAttempts: 3,
        windowHours: 24,
      });
      expect(r2.skipped).toBe(1);
      expect(r2.failed).toBe(0);
    } finally {
      spies.email.send = originalSend;
    }
  });

  it('stops retrying after maxAttempts is reached', async () => {
    const { user: student } = await makeStudent();
    const originalSend = spies.email.send.bind(spies.email);
    spies.email.send = async () => {
      throw new Error('permanent');
    };
    try {
      await enqueueNotification({
        type: 'timetable.change',
        recipients: [student._id],
        title: 'X',
        body: 'Y',
      });

      const base = new Date();
      // 3 retries, each spaced well beyond the exponential backoff window.
      await retryFailedNotifications({
        now: new Date(base.getTime()),
        maxAttempts: 3,
      });
      await retryFailedNotifications({
        now: new Date(base.getTime() + 3600_000),
        maxAttempts: 3,
      });
      await retryFailedNotifications({
        now: new Date(base.getTime() + 2 * 3600_000),
        maxAttempts: 3,
      });

      const doc = await Notification.findOne({});
      expect(doc?.retryCount).toBe(3);

      // Fourth sweep must find nothing (retryCount reached max).
      const r4 = await retryFailedNotifications({
        now: new Date(base.getTime() + 4 * 3600_000),
        maxAttempts: 3,
      });
      expect(r4.processed).toBe(0);
    } finally {
      spies.email.send = originalSend;
    }
  });
});
