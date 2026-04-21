import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { makeStudent } from '../helpers/factories.js';
import { enqueueNotification } from '../../src/services/notificationService.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';

describe('POST /v1/jobs/notifications-retry', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('rejects requests without a valid job signature with 401', async () => {
    const res = await http()
      .post('/v1/jobs/notifications-retry')
      .send({});
    expect(res.status).toBe(401);
  });

  it('signed request retries failed notifications and returns sweep result', async () => {
    const { user: student } = await makeStudent();
    const originalSend = spies.email.send.bind(spies.email);
    spies.email.send = async () => {
      throw new Error('transient');
    };
    try {
      await enqueueNotification({
        type: 'timetable.change',
        recipients: [student._id],
        title: 'X',
        body: 'Y',
      });
    } finally {
      spies.email.send = originalSend;
    }

    const body = {};
    const signed = signJobRequest(body);
    const res = await http()
      .post('/v1/jobs/notifications-retry')
      .set('x-job-timestamp', signed.timestamp)
      .set('x-job-signature', signed.signature)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      processed: 1,
      succeeded: 1,
    });
  });
});
