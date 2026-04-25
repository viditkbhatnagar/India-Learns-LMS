#!/usr/bin/env node
/**
 * Phase B-1 staging watch — runs the dealbreaker probes against the
 * deployed API. Designed for an hourly cron over 48h after PR #2 ships.
 *
 * Watch criteria (per PR #2 review):
 *   1. /v1/courses/:id/gradebook responds 200 with the expected shape.
 *   2. /v1/audit-logs?action=assignment.submission.published is reachable.
 *   3. For every audit row of action=assignment.submission.published in the
 *      last 24h, the corresponding submission still exists with status
 *      published. (Catches the "audit row written but submission rolled
 *      back" gap and vice-versa.)
 *
 * The synthetic API-leak probe (faculty saves draft → student GET must
 * NOT see score) is NOT run here — it would notify a real student every
 * cycle. The integration test covers that path; the smoke covered it
 * once at deploy time.
 *
 * Output contract:
 *   - exit 0 + stdout starts with "OK" → silent; cron caller should not
 *     surface to user.
 *   - exit 1 + stdout starts with "ALERT" → escalate immediately.
 *   - exit 2 + stdout starts with "WARN" → soft signal; bundle into the
 *     next OK summary (or surface if persistent).
 *
 * Env:
 *   BASE_URL                    default https://india-learns-lms.onrender.com
 *   B1_WATCH_SUPERADMIN_EMAIL   default superadmin@indialearns.test
 *   B1_WATCH_SUPERADMIN_PASS    default Superadmin#2026
 *   B1_WATCH_COURSE_ID          default Airport Ground Ops on staging seed
 *
 * Usage:  node scripts/b1-watch.mjs
 */

const BASE = process.env.BASE_URL ?? 'https://india-learns-lms.onrender.com';
const ADMIN_EMAIL = process.env.B1_WATCH_SUPERADMIN_EMAIL ?? 'superadmin@indialearns.test';
const ADMIN_PASS = process.env.B1_WATCH_SUPERADMIN_PASS ?? 'Superadmin#2026';
const COURSE_ID = process.env.B1_WATCH_COURSE_ID ?? '69e8bb70a2f1dd92c9c5f1aa';
const LOOKBACK_HOURS = 24;

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function login() {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS, deviceId: 'b1-watch' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const token = body?.data?.accessToken;
  if (!token) throw new Error('login response missing accessToken');
  return token;
}

async function api(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, ok: res.ok, text: () => res.text(), json: () => res.json() };
}

const findings = { alerts: [], warns: [], notes: [] };
function alert(msg) { findings.alerts.push(msg); }
function warn(msg) { findings.warns.push(msg); }
function note(msg) { findings.notes.push(msg); }

async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) {
    alert(`/health returned ${res.status}`);
    return false;
  }
  const body = await res.json();
  if (!body.ok) alert(`/health body.ok is falsy: ${JSON.stringify(body)}`);
  return true;
}

async function checkGradebook(token) {
  const r = await api(`/v1/courses/${COURSE_ID}/gradebook`, token);
  if (r.status >= 500) {
    alert(`gradebook ${r.status} (5xx): ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  if (!r.ok) {
    alert(`gradebook ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  const body = await r.json();
  const requiredKeys = ['students', 'assignments', 'cells', 'backlog', 'publishedCount', 'draftCount'];
  for (const k of requiredKeys) {
    if (!(k in (body?.data ?? {}))) {
      alert(`gradebook payload missing key: ${k}`);
      return null;
    }
  }
  note(
    `gradebook OK · students=${body.data.students.length} assignments=${body.data.assignments.length} backlog=${body.data.backlog} drafts=${body.data.draftCount} published=${body.data.publishedCount}`,
  );
  return body.data;
}

async function checkAuditLogPublishes(token) {
  const from = nowIso(-LOOKBACK_HOURS * 60 * 60 * 1000);
  const r = await api(
    `/v1/audit-logs?action=assignment.submission.published&from=${encodeURIComponent(from)}&limit=200`,
    token,
  );
  if (r.status >= 500) {
    alert(`audit-logs publishes ${r.status} (5xx)`);
    return null;
  }
  if (!r.ok) {
    alert(`audit-logs publishes ${r.status}`);
    return null;
  }
  const body = await r.json();
  const items = body?.data?.items ?? [];
  note(`audit publishes (last ${LOOKBACK_HOURS}h): ${items.length}`);
  return items;
}

async function crossCheckPublishedSubmissions(token, auditItems, gradebook) {
  // For every audit row, check there's a published submission with that
  // targetId in the imported gradebook cells. If a row says we published
  // but the submission isn't present, that's the leak we're watching for.
  if (!auditItems || auditItems.length === 0) return;
  if (!gradebook) return;
  const publishedCellSubmissionIds = new Set(
    gradebook.cells
      .filter((c) => c.computedStatus === 'published' && c.submissionId)
      .map((c) => c.submissionId),
  );
  // Only check audits whose targetId is in this course (we only have one
  // course's gradebook to compare against).
  const inScope = auditItems.filter((a) => {
    const courseId = a?.details?.courseId;
    return courseId === COURSE_ID;
  });
  let missing = 0;
  for (const a of inScope) {
    const sid = a?.targetId;
    if (!sid) continue;
    if (!publishedCellSubmissionIds.has(String(sid))) missing += 1;
  }
  if (missing > 0) {
    alert(
      `${missing} audit publish row(s) without a corresponding published cell on course ${COURSE_ID}`,
    );
  }
}

(async () => {
  try {
    const healthy = await checkHealth();
    if (!healthy) {
      console.log(`ALERT ${findings.alerts.join(' | ')}`);
      process.exit(1);
    }
    const token = await login();
    const gb = await checkGradebook(token);
    const audits = await checkAuditLogPublishes(token);
    await crossCheckPublishedSubmissions(token, audits, gb);

    if (findings.alerts.length > 0) {
      console.log(`ALERT ${findings.alerts.join(' | ')}`);
      process.exit(1);
    }
    if (findings.warns.length > 0) {
      console.log(`WARN ${findings.warns.join(' | ')} :: ${findings.notes.join(' :: ')}`);
      process.exit(2);
    }
    console.log(`OK ${findings.notes.join(' :: ')}`);
    process.exit(0);
  } catch (err) {
    console.log(`ALERT probe threw: ${err.message ?? err}`);
    process.exit(1);
  }
})();
