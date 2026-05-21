#!/usr/bin/env node
/**
 * sign-job-jwt.mjs
 * ----------------
 * Signs and POSTs an India Learns cron job request.
 *
 * NOTE on the name: the milestone plan references this as `sign-job-jwt.ts`.
 * The actual signing scheme implemented by `api/src/middleware/requireJobAuth.ts`
 * is HMAC-SHA256 over `rawBody + timestamp` carried in `x-job-signature` and
 * `x-job-timestamp` headers — NOT a JWT. The filename is preserved for
 * traceability with M9 planning + TASKS.md; the implementation matches the
 * deployed verifier.
 *
 * Usage (Render cron command, examples):
 *   node scripts/sign-job-jwt.mjs fee-reminders
 *   node scripts/sign-job-jwt.mjs autosuspend
 *   node scripts/sign-job-jwt.mjs sla-timers
 *   node scripts/sign-job-jwt.mjs digest-faculty-weekly
 *   node scripts/sign-job-jwt.mjs notifications-retry
 *
 * Env required:
 *   API_ORIGIN  e.g. https://api.indialearns.com
 *   JOB_SECRET  same value as the API service's JOB_SECRET
 *
 * Exit code 0 on HTTP 2xx; non-zero (1) on transport / signature / non-2xx.
 */

import { createHmac } from 'node:crypto';

const JOB_PATHS = {
  'fee-reminders': '/v1/jobs/fee-reminders',
  autosuspend: '/v1/jobs/autosuspend',
  'sla-timers': '/v1/jobs/sla-timers',
  'digest-faculty-weekly': '/v1/jobs/digest-faculty-weekly',
  'notifications-retry': '/v1/jobs/notifications-retry',
  // Q-M4-03 — nightly retention sweep.
  'notifications-cleanup': '/v1/jobs/notifications-cleanup',
  // Admissions module (M3b + M9).
  'admissions-referee-reminders': '/v1/jobs/admissions-referee-reminders',
  'admissions-audit-head-snapshot': '/v1/jobs/admissions-audit-head-snapshot',
  'admissions-draft-cleanup': '/v1/jobs/admissions-draft-cleanup',
  // M10 — Daily attendance auto-report (LMS_Requirements §2 + §5).
  'daily-attendance-report': '/v1/jobs/daily-attendance-report',
};

function fail(message, code = 1) {
  console.error(`[sign-job-jwt] ${message}`);
  process.exit(code);
}

const jobName = process.argv[2];
if (!jobName) {
  fail(`missing job name. Usage: node ${process.argv[1]} <jobName>`);
}
const path = JOB_PATHS[jobName];
if (!path) {
  fail(`unknown job '${jobName}'. Known: ${Object.keys(JOB_PATHS).join(', ')}`);
}

const apiOrigin = (process.env.API_ORIGIN || '').replace(/\/$/, '');
const jobSecret = process.env.JOB_SECRET || '';
if (!apiOrigin) fail('API_ORIGIN env var is required');
if (!jobSecret) fail('JOB_SECRET env var is required');

const body = '{}';
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac('sha256', jobSecret)
  .update(`${body}${timestamp}`)
  .digest('hex');

const url = `${apiOrigin}${path}`;
console.log(`[sign-job-jwt] POST ${url} (job=${jobName})`);

try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-job-signature': signature,
      'x-job-timestamp': timestamp,
    },
    body,
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    fail(`upstream ${res.status}: ${text.slice(0, 500)}`);
  }
  console.log(`[sign-job-jwt] ${res.status} ${text.slice(0, 300)}`);
  process.exit(0);
} catch (err) {
  fail(`request failed: ${err instanceof Error ? err.message : String(err)}`);
}
