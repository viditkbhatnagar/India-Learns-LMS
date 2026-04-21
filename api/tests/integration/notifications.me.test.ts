import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeNotification, makeStudent } from '../helpers/factories.js';

describe('/v1/notifications/me', () => {
  useMongo();
  useIntegrationSpies();

  it('lists own notifications and marks one read', async () => {
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const n1 = await makeNotification({
      userId: student._id,
      title: 'One',
      body: 'first',
    });
    await makeNotification({
      userId: student._id,
      title: 'Two',
      body: 'second',
    });

    const list = await http().get('/v1/notifications/me').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(2);
    expect(list.body.data.items[0].readAt).toBeNull();

    const read = await http()
      .post(`/v1/notifications/${n1._id.toString()}/read`)
      .set(bearer(at));
    expect(read.status).toBe(200);
    expect(read.body.data.notification.readAt).not.toBeNull();

    const unread = await http()
      .get('/v1/notifications/me?unreadOnly=true')
      .set(bearer(at));
    expect(unread.body.data.items).toHaveLength(1);
    expect(unread.body.data.items[0].id).not.toBe(n1._id.toString());
  });

  it('404 when marking another user\'s notification read', async () => {
    const { user: s1 } = await makeStudent();
    const { user: s2 } = await makeStudent();
    const at = await tokenFor(s2);
    const n = await makeNotification({ userId: s1._id });
    const res = await http()
      .post(`/v1/notifications/${n._id.toString()}/read`)
      .set(bearer(at));
    expect(res.status).toBe(404);
  });
});
