# 05 — Deployment Runbook (Render + MongoDB Atlas)

**Product:** India Learns LMS
**Version:** 1.0
**Date:** 21 April 2026

This runbook is what you follow on the day of deployment and whenever the stack changes. It is prescriptive — if a step is skipped, mark it in the deploy log and justify why.

---

## 1. Target environments

| Env | Purpose | URLs | Data |
|---|---|---|---|
| `dev` | Local developer | `http://localhost:5173`, `http://localhost:3000/v1` | Local Mongo (Docker) or Atlas sandbox |
| `staging` | June test cohort | `https://staging-app.indialearns.com`, `https://staging-api.indialearns.com` | Atlas M0 shared, seeded test data |
| `prod` | July launch | `https://app.indialearns.com`, `https://api.indialearns.com` | Atlas M10 dedicated, Mumbai |

---

## 2. MongoDB Atlas setup

1. Create Atlas organisation **LUC India** and project **India Learns**.
2. Create a cluster:
   - **prod:** `il-prod`, M10, AWS `ap-south-1` (Mumbai). Backup cadence: continuous (PITR).
   - **staging:** `il-staging`, M0/M2 shared, same region.
3. Create two DB users per cluster:
   - `il_app` — readWrite on database `il`. Used by API.
   - `il_migrate` — readWrite + dbAdmin on `il`. Used by migration script only.
4. Network access: add Render's egress IPs for the API service region. Atlas supports "Allow from anywhere" temporarily for setup, but the production allowlist must be restricted to Render before launch.
5. Create the database `il` and collections will be created implicitly by Mongoose.
6. Enable **alerts** for: high CPU, high connection count, replication lag, backup failure. Route alerts to `ops@luc-india.example`.
7. Note connection strings and store them in Render env (never commit):
   - `MONGODB_URI=mongodb+srv://il_app:<pw>@il-prod.xxxxx.mongodb.net/il?retryWrites=true`.

---

## 3. Render setup

### 3.1 Blueprint (`render.yaml` in repo root)

```yaml
services:
  - type: web
    name: il-api
    env: node
    plan: standard           # Upgrade on sustained CPU > 60 %
    region: singapore        # Closest Render region to Mumbai
    rootDir: api
    buildCommand: npm ci && npm run build
    startCommand: node dist/index.js
    healthCheckPath: /healthz
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - fromGroup: il-api-secrets
  - type: static
    name: il-web
    env: static
    rootDir: web
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    pullRequestPreviewsEnabled: true
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=0, must-revalidate
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
    envVars:
      - fromGroup: il-web-secrets
    routes:
      - type: rewrite
        source: /*
        destination: /index.html   # SPA routing
cronJobs:
  - name: il-cron
    schedule: '*/15 * * * *'       # master cron; endpoint handles dispatch
    command: curl -sf -X POST -H "Authorization: Bearer $JOB_JWT" $API_ORIGIN/v1/jobs/dispatch
    envVars:
      - fromGroup: il-api-secrets
envVarGroups:
  - name: il-api-secrets
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: JOB_SECRET
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: SENDGRID_API_KEY
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: CERTIFIER_API_KEY
        sync: false
      - key: META_WABA_PHONE_ID
        sync: false
      - key: META_WABA_ACCESS_TOKEN
        sync: false
      - key: API_ORIGIN
        value: https://api.indialearns.com
      - key: WEB_ORIGIN
        value: https://app.indialearns.com
      - key: COOKIE_DOMAIN
        value: .indialearns.com
      - key: EMAIL_FROM
        value: India Learns <notifications@app.indialearns.com>
      - key: RECEIPT_ORG_NAME
        value: India Learns (LUC)
      - key: RECEIPT_ORG_ADDRESS
        value: PENDING
      - key: RECEIPT_ORG_GSTIN
        value: ""
      - key: RECEIPT_LOGO_URL
        value: https://res.cloudinary.com/.../logo.svg
      - key: WHATSAPP_ENABLED
        value: "false"
      - key: CERTIFIER_ENABLED
        value: "false"
      - key: LOG_LEVEL
        value: info
  - name: il-web-secrets
    envVars:
      - key: VITE_API_BASE
        value: https://api.indialearns.com/v1
      - key: VITE_APP_ORIGIN
        value: https://app.indialearns.com
      - key: VITE_SENTRY_DSN
        sync: false
      - key: VITE_ENABLE_PWA
        value: "true"
```

The cron job above hits a single dispatcher endpoint (`/v1/jobs/dispatch`) that internally decides which jobs should run based on the current minute. This avoids the Render "one schedule per cron" fee. If you prefer one cron per job, define them separately per TRD §10.1.

### 3.2 Service creation steps

1. Log into Render → Blueprints → **New blueprint** → connect GitHub repo `india-learns` → Render parses `render.yaml`.
2. Click **Apply**. Confirm the service names and regions.
3. Fill in each `sync:false` secret in the Render UI (values come from `MONGODB_URI` in Atlas, Cloudinary console, Resend dashboard, etc.).
4. Wait for first build. API health at `https://il-api.onrender.com/healthz` must return `200`.
5. Frontend first build — verify `https://il-web.onrender.com` loads the login page.

### 3.3 DNS & SSL

1. Register domain (see BRD risk R1). Assume `indialearns.com`.
2. In Render:
   - `il-api` → Custom domain → `api.indialearns.com`.
   - `il-web` → Custom domain → `app.indialearns.com` (and optionally root → apex with redirect).
3. Add the CNAMEs Render tells you at your registrar. Wait up to 30 min for TLS.
4. In Resend, verify the sender domain `app.indialearns.com`:
   - SPF: `v=spf1 include:_spf.resend.com -all`
   - DKIM: Resend issues a CNAME, add it.
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@indialearns.com`.

### 3.4 First deploy sanity

```
GET https://api.indialearns.com/healthz   → { ok: true }
GET https://app.indialearns.com            → login screen renders
```

---

## 4. Secrets and env matrix

Every secret in Render is set **per service** and marked `sync: false`. The full list lives in TRD §12. Before go-live, run the checklist below in Render:

- [ ] `MONGODB_URI`
- [ ] `JWT_SECRET` (64 bytes base64)
- [ ] `JOB_SECRET` (64 bytes base64)
- [ ] `RESEND_API_KEY` (or `SENDGRID_API_KEY`)
- [ ] `CLOUDINARY_*` (all three)
- [ ] `CERTIFIER_API_KEY` (or `CERTIFIER_ENABLED=false` until ready)
- [ ] `META_WABA_PHONE_ID` + `META_WABA_ACCESS_TOKEN` (or `WHATSAPP_ENABLED=false`)
- [ ] `RECEIPT_ORG_ADDRESS` and `RECEIPT_ORG_GSTIN` set (or "PENDING" placeholder accepted for staging)
- [ ] `RECEIPT_LOGO_URL` set to a Cloudinary-hosted logo
- [ ] `VITE_SENTRY_DSN` (optional but strongly recommended)

Rotate `JWT_SECRET` every 180 days. When rotated, bump a version claim (`kid`) and keep the previous secret active for 48 h to allow token refresh.

---

## 5. Seeding

On first production boot, run once:

```
npm -w api run seed:admin -- --email logan@luc.example --name "Logan"
```

This creates a `role:admin` user and prints a one-time magic link. Do not reuse on subsequent deploys — use the script once, delete the invocation.

---

## 6. Cron wiring

Render cron hits the dispatcher:

```
*/15 * * * *  →  POST https://api.indialearns.com/v1/jobs/dispatch
```

Inside the dispatcher, the server:
- At minute `0` each hour → runs `feeReminders`.
- Every `30` min → runs `slaTimers`.
- Daily 03:30 IST (= 22:00 UTC) → runs `autosuspend`.
- Monday 09:00 IST → runs `digestFacultyWeekly`.

The dispatcher verifies `Authorization: Bearer <JOB_JWT>` and short-circuits if the signed JWT is invalid. The JOB_JWT is generated by the cron shell command on the fly:

```bash
JOB_JWT=$(node -e "
import('jose').then(async (jose) => {
  const secret = new TextEncoder().encode(process.env.JOB_SECRET);
  const jwt = await new jose.SignJWT({ iss:'render-cron', aud:'il-api' })
    .setProtectedHeader({ alg:'HS256' })
    .setExpirationTime('5m')
    .sign(secret);
  process.stdout.write(jwt);
});
")
curl -sfS -X POST -H "Authorization: Bearer $JOB_JWT" $API_ORIGIN/v1/jobs/dispatch
```

---

## 7. Backups and DR

- Atlas continuous backups with 7-day PITR for `il-prod`.
- Weekly full snapshot retained 30 days.
- Quarterly restore drill: restore latest snapshot into `il-prod-restore`, run smoke tests, then delete. Record in `docs/dr-drills/<date>.md`.
- Cloudinary has its own redundancy — we treat course files as re-uploadable if lost.
- Receipts PDFs are double-stored: Cloudinary + a monthly zip pushed to Cloudinary `il/receipts-archive/YYYY-MM.zip` from `jobs/receiptArchive.ts` (Phase 2 enhancement — not required for launch).

---

## 8. Monitoring and logs

- Render dashboard shows CPU, memory, and log tail. Set alerts for: CPU > 80 % for 10 min, any restart, any deploy failure.
- Sentry captures exceptions from both API and Web.
- Atlas alerts per §2.6.
- `/healthz` and `/readyz` monitored externally by BetterStack (or UptimeRobot) every 1 min from two regions; page an on-call if down 2 × in a row.
- Keep 30-day log retention in Render; export to S3 if longer retention is required.

---

## 9. Pre-launch smoke tests

Run this list from a fresh browser profile on both desktop and phone:

- [ ] Root URL shows login screen.
- [ ] Admin seed user can log in.
- [ ] Admin creates a Student → invite email arrives in inbox.
- [ ] Student clicks magic link → sets password → lands on dashboard.
- [ ] Admin creates Program + Course + Module with 1 video and 1 PDF.
- [ ] Admin publishes course; Student sees it and can play/open content.
- [ ] Admin creates Batch; enrols the Student; Student's dashboard updates.
- [ ] Admin sets timetable; Student sees it on `/timetable`.
- [ ] Admin creates FeeStructure; system generates installments on enrolment.
- [ ] Finance records a payment; receipt PDF downloads; Student sees "Paid" + notification.
- [ ] Student raises an Academic ticket; Faculty gets email + in-app; replies; Student sees reply.
- [ ] Student cannot raise a Complaint ticket until one Resolved ticket exists.
- [ ] Faculty gives rubric + written + summary feedback; Student sees it + gets email.
- [ ] Student attempts a quiz; passes; module marked complete.
- [ ] Final exam essays graded by Faculty; exam marked passed.
- [ ] Admin issues certificate; certificate URL arrives in email.
- [ ] Simulate 14-day overdue installment (bump dates in staging) → student enters `warn1` banner.
- [ ] Simulate 28-day overdue → student suspended; blocked from course pages; Finance ticket still accessible.
- [ ] Admin overrides suspension; student regains access.
- [ ] Cron `/jobs/dispatch` hit manually (with JOB_JWT) → response OK.
- [ ] Service worker registers; app installs on a phone; offline dashboard (last loaded) still renders.
- [ ] Sentry captures a forced error from `/admin/debug/throw` (endpoint behind `NODE_ENV!=='production'`).

Only after every box above is checked do we flip the domain DNS to production.

---

## 10. Go-live day runbook

**T-24h:**
- Freeze `main`. Only doc commits allowed.
- Final staging smoke test (§9).
- Announce the launch window to LUC team via email.

**T-2h:**
- Tag release `v1.0.0` on `main`.
- Render auto-deploys API and Web.
- Watch build logs; verify `healthz` post-deploy.

**T-0 (flip):**
- Switch DNS from staging to prod (already done if domains differ).
- Send "We're live" email to the invited cohort with login URL.
- On-call dev on Slack/WhatsApp.

**T+1h:**
- Review Sentry + Render logs for surprises.
- Spot-check 3 random student logins.
- Review first batch of magic-link email deliveries.

**T+24h:**
- Reconcile any Finance recordings.
- Review SLA breach dashboard for tickets raised in first day.
- Post-mortem on any surprises — fix or triage into backlog.

---

## 11. Rollback

Render keeps the last 10 deploys per service. To rollback:

1. Render dashboard → service → **Deploys** → select last known-good → **Redeploy**.
2. Verify `healthz`.
3. If the issue was data-related (e.g., migration), restore Mongo PITR to the deploy moment and then rollback the service.

Target rollback time: **≤ 30 minutes** from decision to green.

---

## 12. Known deploy gotchas (write into the repo README)

- Render's `Authorization` header is stripped on redirects, so all cron calls must hit the final URL directly (no 301 chain).
- Vite env vars are inlined at build time — changing `VITE_*` requires a rebuild of `il-web`.
- Cloudinary signed URLs expire; for receipts we return a fresh signed URL on each `GET /receipts/:id/download`.
- The Render "singapore" region is our closest option to Mumbai. Expect ~50 ms cross-region latency to Atlas ap-south-1; well within our P95 budget.

---

## 13. Contact tree (incident)

| Role | Contact | Notes |
|---|---|---|
| Sponsor | Rejin Rajan | Budget / scope decisions |
| Product steward | Logan | Go/no-go on features, domain access |
| Dev on-call | Vidit Bhatnagar (Phase 1) | Code + deploy |
| Finance operator | PENDING | For payment questions during launch week |
| IT admin | PENDING | For account issues during launch week |

Update this table in the repo `README.md` once PENDING items are filled.

---

_End of Deployment Runbook. This completes the Phase 1 Claude Code document pack. Start with `CLAUDE.md`._
