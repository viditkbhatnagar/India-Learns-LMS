# DEPLOY.md — India Learns go-live runbook

> Source of truth: `claude-code-docs/05_Deployment_Runbook.md` §9.
> This file is the operator's checklist. Spec wins on any drift.

---

## Pre-requisites (one-time setup)

1. **GitHub repo access** — push rights on `main`.
2. **Render account** — Owner role on the workspace that holds `il-api`, `il-web`, and the five `il-cron-*` services.
3. **MongoDB Atlas** — a cluster (M0 free tier is fine for staging) in `ap-south-1` (Mumbai) for DPDP alignment.
4. **Provider accounts** — at least one of: Brevo, Resend, SendGrid (for email). Cloudinary for media. Optional: Sentry, Certifier.io, Meta WABA.
5. **Domain** — `app.indialearns.com` + `api.indialearns.com` registered and DNS editable. *(Skip if launching on the default `*.onrender.com` URLs — `render.yaml` is parameterised.)*

---

## T-24h — Stage everything

```bash
# 1. Freeze main: doc-only commits from here.
# 2. Verify the build is green locally.
npm install
npm run lint
npm run typecheck
npm test
npm run build

# 3. From the Render dashboard:
#    a. New → Blueprint → connect this repo → Render reads `render.yaml`.
#    b. Fill the secret groups (see "Secrets" below).
#    c. Trigger first deploy.

# 4. Verify health from your machine:
curl -fsSL https://<api-url>/healthz
# Expected: {"ok":true,"commit":"<git-sha>","uptimeSec":N,"ts":"..."}

# 5. Seed the super-admin (set the SUPERADMIN_* env vars temporarily, then run):
#    via Render Shell tab on `il-api`:
SUPERADMIN_EMAIL=admin@luc-india.example \
SUPERADMIN_PASSWORD='<strong-pass>' \
SUPERADMIN_NAME='LUC Admin' \
SUPERADMIN_PHONE='+91XXXXXXXXXX' \
npm run seed:superadmin -w api
# Then unset the SUPERADMIN_* vars from the secret group.

# 6. Run the 24-step pre-launch smoke test against staging:
#    docs/smoke/m9-launch.md — tick every box.

# 7. Email LUC team the launch window with staging URL + smoke results.
```

### Secrets (drop into the Render `il-api-secrets` and `il-web-secrets` groups)

| Var | Group | How to generate |
|---|---|---|
| `MONGODB_URI` | il-api-secrets | Atlas → Connect → "drivers" string. Use a per-env user, *not* atlas admin. |
| `JWT_SECRET` | il-api-secrets | `openssl rand -base64 64` |
| `JOB_SECRET` | il-api-secrets | `openssl rand -base64 64` (different from JWT_SECRET) |
| `BREVO_API_KEY` *(or RESEND/SENDGRID)* | il-api-secrets | Provider dashboard → API keys |
| `SENDGRID_API_KEY` | il-api-secrets | Set even if Brevo/Resend is primary — used as automatic fallback |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | il-api-secrets | Cloudinary console → Account details |
| `META_WABA_PHONE_ID`, `META_WABA_ACCESS_TOKEN` | il-api-secrets | Meta Business Suite (only if `WHATSAPP_ENABLED=true`) |
| `CERTIFIER_API_KEY`, `CERTIFIER_DEFAULT_TEMPLATE_ID` | il-api-secrets | Certifier.io dashboard (only if `CERTIFIER_ENABLED=true`) |
| `RECEIPT_ORG_ADDRESS`, `RECEIPT_ORG_GSTIN` | il-api-secrets | LUC legal entity info (Q-PENDING-02) |
| `SENTRY_DSN` | il-api-secrets | Sentry → New project (Node) → DSN |
| `VITE_SENTRY_DSN` | il-web-secrets | Sentry → New project (React) → DSN |

> Leaving Sentry DSN empty is supported — Sentry init becomes a no-op.
> Leaving WhatsApp / Certifier vars empty is supported — adapters fall back to console stubs.
> SendGrid as a fallback only kicks in when `EMAIL_PROVIDER` is `brevo` or `resend` AND `SENDGRID_API_KEY` is set.

---

## T-2h — Tag the release

```bash
# 1. From repo root, create the release tag.
git tag -s v1.0.0 -m "India Learns v1.0.0 — initial launch"
git push origin v1.0.0
# Render auto-deploys the matching commit.

# 2. Watch build logs in the Render dashboard for il-api + il-web.
#    Expect green checkmark inside ~5 minutes.

# 3. Re-curl /healthz to confirm new build is live (look at the `commit` field).
curl -fsSL https://<api-url>/healthz | jq .commit
```

---

## T-0 — DNS flip

1. **Set DNS** at the registrar:
   - `api.indialearns.com` CNAME → `<your-il-api>.onrender.com`
   - `app.indialearns.com` CNAME → `<your-il-web>.onrender.com`
2. **Add the custom domains** in Render dashboard (one for each service). Render will issue Let's Encrypt certs automatically.
3. **Verify** from a fresh browser:
   ```bash
   curl -fsSL https://api.indialearns.com/healthz
   curl -fsSL https://app.indialearns.com/ | head -20
   ```
4. **Send "We're live" email** to LUC team with login URL + super-admin onboarding doc.
5. **On-call dev** stays on Slack for the first hour.

---

## T+1h — Watchful first hour

```bash
# 1. Sentry — new project page, sort by frequency. Triage anything ≥ 5 events.
# 2. Render logs — both services, scan for repeated 5xx.
# 3. Spot-check 3 random student logins (from invite emails) end-to-end.
# 4. Verify the first batch of invite emails landed (check Brevo/Resend dashboard).
# 5. Confirm one cron tick succeeded:
#    Render dashboard → il-cron-sla-timers → most recent run = success.
```

---

## T+24h — Reconcile + retro

```bash
# 1. Finance reconciliation: pull /v1/analytics/collections?from=<launch>&to=now
#    cross-check against any manual receipts.
# 2. SLA dashboard: /admin/tickets/sla-breaches — should be 0.
# 3. Notification retry sweep — check ApiCostLedger for any `email.send.fallback`
#    rows (Brevo→SendGrid fallback wins). Investigate if rate > 1%.
# 4. Post-mortem on any surprises. Append to /memory/decisions.md.
# 5. Schedule first weekly faculty digest verification (Mon 09:00 IST).
```

---

## Rollback

If a critical bug surfaces post-T-0:

```bash
# 1. In Render dashboard, click "Roll back" on il-api to the last known-good
#    deploy. il-web rolls forward only — re-deploy the previous git SHA via
#    "Manual deploy → Deploy specific commit".
# 2. Document the incident in /memory/decisions.md (D-NNN entry).
# 3. Notify LUC team with ETA for fix-forward.
```

DNS is **not** rolled back unless the bug is data-corrupting — Render rollback alone reverts the service binary.

---

## Outstanding pre-launch items (must resolve)

These are tracked in `/memory/open-questions.md` and block a public launch (ok for internal staging):

- **Q-M1-01** — confirm "India Learns" name + `app.indialearns.com` domain (Logan).
- **Q-PENDING-01** — official logo SVG (currently using `/brand/logo-placeholder.svg`).
- **Q-PENDING-02** — receipt office address + GSTIN.
- **Q-PENDING-04…06** — name finance / content / IT operators (UAT depends on this).
- **Q-PENDING-07** — Meta WABA template approval (toggle `WHATSAPP_ENABLED=true` only after).
- **Q-PENDING-08** — Certifier.io API key (toggle `CERTIFIER_ENABLED=true` only after).
- **Q-PENDING-09** — Cloudinary live-mode credentials.
