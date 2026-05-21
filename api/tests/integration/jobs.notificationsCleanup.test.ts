import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { makeStudent } from '../helpers/factories.js';
import { enqueueNotification } from '../../src/services/notificationService.js';
import { Notification } from '../../src/models/index.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';

// Q-M4-03 — nightly retention sweep
describe('POST /v1/jobs/notifications-cleanup', () => {
  useMongo();
  useIntegrationSpies();

  it('rejects requests without a valid job signature with 401', async () => {
    const res = await http()
      .post('/v1/jobs/notifications-cleanup')
      .send({});
    expect(res.status).toBe(401);
  });

  it('deletes read notifications older than 90d and unread older than 365d; preserves recent', async () => {
    const { user: student } = await makeStudent();

    // Build a deterministic mix: 1 fresh-read, 1 fresh-unread, 1 stale-read,
    // 1 stale-unread (>365d). Use createdAt/readAt direct overrides so we
    // don't have to wait wall-clock time.
    const oneDay = 86_400_000;
    const now = Date.now();
    const oldRead = new Date(now - 100 * oneDay); // > 90d (read)
    const oldUnread = new Date(now - 400 * oneDay); // > 365d (unread)
    const freshRead = new Date(now - 5 * oneDay); // < 90d (read)
    const freshUnread = new Date(now - 30 * oneDay); // < 365d (unread)

    await enqueueNotification({
      type: 'timetable.change',
      recipients: [student._id],
      title: 'old-read',
      body: 'old-read',
    });
    await enqueueNotification({
      type: 'timetable.change',
      recipients: [student._id],
      title: 'old-unread',
      body: 'old-unread',
    });
    await enqueueNotification({
      type: 'timetable.change',
      recipients: [student._id],
      title: 'fresh-read',
      body: 'fresh-read',
    });
    await enqueueNotification({
      type: 'timetable.change',
      recipients: [student._id],
      title: 'fresh-unread',
      body: 'fresh-unread',
    });

    // Mongoose flags `createdAt` immutable when `timestamps: true`, so
    // model.updateOne silently drops `$set: { createdAt }`. Drop to the
    // raw collection so we can backdate notifications for the sweep test.
    await Notification.collection.updateOne(
      { title: 'old-read' },
      { $set: { createdAt: oldRead, readAt: oldRead } },
    );
    // Mongoose flags `createdAt` immutable when `timestamps: true`, so
    // model.updateOne silently drops `$set: { createdAt }`. Drop to the
    // raw collection so we can backdate notifications for the sweep test.
    await Notification.collection.updateOne(
      { title: 'old-unread' },
      { $set: { createdAt: oldUnread, readAt: null } },
    );
    // Mongoose flags `createdAt` immutable when `timestamps: true`, so
    // model.updateOne silently drops `$set: { createdAt }`. Drop to the
    // raw collection so we can backdate notifications for the sweep test.
    await Notification.collection.updateOne(
      { title: 'fresh-read' },
      { $set: { createdAt: freshRead, readAt: freshRead } },
    );
    // Mongoose flags `createdAt` immutable when `timestamps: true`, so
    // model.updateOne silently drops `$set: { createdAt }`. Drop to the
    // raw collection so we can backdate notifications for the sweep test.
    await Notification.collection.updateOne(
      { title: 'fresh-unread' },
      { $set: { createdAt: freshUnread, readAt: null } },
    );

    const body = {};
    const signed = signJobRequest(body);
    const res = await http()
      .post('/v1/jobs/notifications-cleanup')
      .set('x-job-timestamp', signed.timestamp)
      .set('x-job-signature', signed.signature)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ readDeleted: 1, unreadDeleted: 1 });

    const remaining = await Notification.find({}).select('title').lean();
    const titles = remaining.map((r) => r.title).sort();
    expect(titles).toEqual(['fresh-read', 'fresh-unread']);
  });

  it('second invocation in same minute is a no-op (idempotent)', async () => {
    const body = {};
    const signed = signJobRequest(body);
    const res = await http()
      .post('/v1/jobs/notifications-cleanup')
      .set('x-job-timestamp', signed.timestamp)
      .set('x-job-signature', signed.signature)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ readDeleted: 0, unreadDeleted: 0 });
  });
});
