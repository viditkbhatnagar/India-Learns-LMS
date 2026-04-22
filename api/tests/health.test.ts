import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 with ok:true and commit metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.commit).toBe('string');
    expect(typeof res.body.uptimeSec).toBe('number');
    expect(typeof res.body.ts).toBe('string');
  });

  it('GET /healthz returns the same payload (Render + uptime probes)', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns the error envelope on unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
