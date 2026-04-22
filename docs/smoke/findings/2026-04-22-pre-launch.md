# Pre-launch verification report — 2026-04-22

**Session type:** verification + MongoDB Atlas setup (NOT a new milestone).
**Operator:** Vidit.
**Scope:** Parts A (local verify), B1–B5 (Atlas + seed + Playwright + Lighthouse), C (report + memory checkpoint).

---

## Part A — local verification

| Step | Result | Detail |
|---|---|---|
| A1 `npm install` | ✅ | 94 packages. ⚠️ `EBADENGINE` warning — local Node is v24.10.0, `package.json` pins `>=20.12 <21`. Render service uses Node 20 per `render.yaml` — non-blocking locally. |
| A2 `npm run lint` | ✅ | `eslint . --max-warnings=0` clean. |
| A3 `npm run typecheck` | ✅ | shared-types + api + web all clean (including the new `api/scripts/seed-demo.ts`). |
| A4 `npm test` + `--coverage` | ✅ | **409/409 tests across 78 files**. Services coverage: **82.52% lines / 65.97% branches / 92.02% funcs** (gate ≥70% lines ✅). Q-M7-05 payments.record flake did NOT reproduce on this run. |
| A5 `npm run build` | ✅ | shared-types + api + web all build. Web bundle 808.60 KB / gzip 237.78 KB (single-chunk — known v1.1 bundle-split todo). PWA emitted `web/dist/sw.js` (1.8 KB) + `manifest.webmanifest` (545 B) + `workbox-83453184.js`. Precache 8 entries / 818 KiB. |

---

## A6 — open-questions punch list (what I need from Logan / LUC)

### 🔴 BLOCKERS for staging deploy + go-live
| Q# | Ask | Owner |
|---|---|---|
| Q-M1-01 | Confirm "India Learns" + `app.indialearns.com` (spec pack consistent, but root CLAUDE.md had "India LearnHub" once) | Logan |
| Q-PENDING-03 | DNS records for `app.indialearns.com` + `api.indialearns.com` | Rejin |
| Q-PENDING-02 | Registered office address + GSTIN for receipts (receipts print "PENDING" until set) | Rejin |
| Q-PENDING-04 | Named Finance operator (seed uses placeholder `finance-seed-1@luc.local`) | Logan |
| Q-PENDING-09 | Cloudinary creds for staging Cloudinary round-trip | Rejin / LUC IT |

### 🟡 SHIP BLOCKERS for full feature parity
| Q# | Ask | Owner |
|---|---|---|
| Q-PENDING-01 | Official logo SVG (placeholder currently committed) | Logan / Rejin |
| Q-PENDING-07 | Meta WABA template approval (keeps `WHATSAPP_ENABLED=false` until then) | LUC ops |
| Q-PENDING-08 | Certifier.io API key (keeps `CERTIFIER_ENABLED=false` until then) | Logan / Vidit |
| Q-M6-03 | Re-confirm `il_ticket_update` WABA variable order | LUC ops |
| Q-PENDING-05 | Named content manager | Logan |
| Q-PENDING-06 | Named IT/system admin | Logan / Rejin |

### 🟢 Product calls (not blocking deploy)
| Q# | Ask |
|---|---|
| Q-M5-01 | FeeStructure weights[] as 40/30/30 default? |
| Q-M5-03 | Suspension override hard 30-day cap or open-ended? |
| Q-M5-04 | Payment reversal window: 24h (current), 48h, or unbounded? |
| Q-M5-05 | Autosuspend cron respects weekends/holidays? |
| Q-M7-01 | Course-completion predicate — simplified (quizzes + exam) or restore "all modules opened"? |
| Q-M8-01 | API cost rates — confirm against real provider invoices after first month |

---

## Part B — Atlas + seed + e2e + Lighthouse

### B1 — Atlas cluster
- Operator provisioned an existing dev cluster instead of a fresh `india-learns-verify` one:
  - Host: `dev.gdddmth.mongodb.net`
  - User: `agi_admin`
  - DB: `india_learns`
  - Region: per-operator. ⚠️ **Confirm this cluster lives in AWS ap-south-1 (Mumbai)** before we point prod at it — BRD BR-11 (DPDP Act 2023) requires Indian data residency.

### B2 — wire + health
- Wrote `MONGODB_URI` into `api/.env` (confirmed `.gitignore:14:.env` ignores it).
- `set -a; source api/.env; set +a; npm run dev -w api` → `mongo connected` (host `ac-fpipeou-shard-00-00.gdddmth.mongodb.net`, db `india_learns`).
- `curl http://localhost:4000/health` → `{"ok":true,"commit":"dev","uptimeSec":…}` ✅.
- `curl http://localhost:4000/healthz` → same ✅ (D-078 alias verified live).

### B3 — seed
- `npm run seed:superadmin -w api` → super-admin created at id `69e8a0c0758f3bfcbdc161e9` / `superadmin@indialearns.test`.
- `npm run seed -w api` → existing broader seed (fixtures for Playwright).
- **New:** `api/scripts/seed-demo.ts` + `npm run seed:demo -w api` — pre-launch demo per this session's spec:
  - 2 batches (one per program) starting next Monday IST (2026-04-27).
  - 40/30/30 FeeStructure for Aviation (weights=[40,30,30] on a `monthly_x`/`monthlyCount=3` component).
  - 3 demo students codes **IL-2026-0101 / 0102 / 0103** (shifted from 0001..0003 to avoid a User.code unique-index collision with the seed.ts fixtures; see source comment).
  - Invoices generated + first installment's `dueDate` shifted to today+7 so the fee-reminder cron's T-7 fires today.
  - 2 holidays in the next 30 days (2026-05-01 Labour Day, 2026-05-13 Buddha Purnima observed).
- Idempotent: re-run showed `invoicesCreated=0, installmentsShiftedToT7=0, holidays: skipped×2`.

**Final collection counts after all 3 seeds ran:**
```
users                9   (1 super + 2 faculty + 2 finance + 1 seed-student + 3 demo-students)
programs             2
batches              3   (1 seed aviation + 2 demo aviation + retail)
courses              2   (airport-ground-ops + retail-merchandising-101)
enrollments          4
invoices             6
feeinstallments     14
feestructures        2
holidays             3
payments             1
tickets              3
notifications        2
auditlogs            9
notificationprefs    9
timetableentries     2
certificates         0   (stub cert URL lives on the Enrollment row, not a separate collection)
```

### B4 — Playwright: ❌ 3 passed / 29 failed

**Root cause (single):** the web client's `authApi.login()` in [web/src/lib/endpoints.ts:33](../../web/src/lib/endpoints.ts#L33) POSTs only `{ email, password }`. The API in [api/src/routes/auth.ts:20-24](../../api/src/routes/auth.ts#L20) *requires* `deviceId: z.string().min(1).max(128)` — so every login gets rejected with `{ error: { code: "VALIDATION_ERROR", ... } }` and the UI shows "Request failed validation." The same missing field affects `/auth/invite/accept` and `/auth/refresh`.

This is the M2 open question **Q-M2-01** ("deviceId convention — plan is UUIDv4 in localStorage, not yet enforced") finally biting. The M9 memory checkpoint's claim that Playwright passes was aspirational — nothing in the build pipeline actually exercised a browser login end-to-end until this session.

**Tests that passed (3):**
- `auth.spec.ts › login screen renders with brand and form` (no login attempt).
- `auth.spec.ts › rejects bad credentials with an error` (passes because ANY login fails validation → the "failed/invalid/incorrect" regex matches).
- `axe.spec.ts › login page is accessible` (anonymous page).

**Tests that failed (29):** every spec that depends on being logged in — `auth` role-routing (3), `student-journey` (5), `axe` authenticated sweep (19), `screenshots` (4). All fail at `page.waitForURL(/\/student\/dashboard/) Timeout` because the app never leaves `/login`.

**Also tripped:** login rate-limiter (`LOGIN_RATE_MAX=5`) during the first Playwright run. Set `RATE_LIMITS_DISABLED=true` in `api/.env` for the verification session; real prod should keep rate-limits on and rely on the M2 per-key limiter.

**Fix is on me (not you):**
1. Generate a per-browser UUID in localStorage once (e.g. `lib/deviceId.ts`).
2. Include `deviceId` in `authApi.login`, `authApi.acceptInvite`, `authApi.refresh`.
3. ~3 small diffs.

**No axe violations to triage** — axe never got to run against authenticated screens. We'll revisit after the deviceId fix.

### B5 — Lighthouse

Ran `npx lighthouse http://localhost:5173/student/dashboard --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./lighthouse-student.json --chrome-flags="--headless"`.

`finalDisplayedUrl: http://localhost:5173/login` — Lighthouse is anonymous; the SPA's `RequireAuth` guard redirected `/student/dashboard` → `/login` before the first paint, so these scores reflect **the login page**, not the dashboard. To score the real dashboard we'd need a Playwright-exported storage-state with a valid session (documented in `web/scripts/lighthouse.mjs`).

| Category | Score | M9 gate (≥90) |
|---|---|---|
| Performance | **55** | ❌ |
| Accessibility | **94** | ✅ |
| Best Practices | **100** | ✅ |
| SEO | **82** | ❌ |

- **Performance 55** — consistent with the single 808 KB / 237 KB gzip web chunk noted in M9. `recharts` + `@sentry/react` are the biggest contributors. v1.1 polish: `manualChunks` split.
- **SEO 82** — login page is missing `meta[name=description]` and probably `<meta name=robots>`. A minimal public-page head fixup would push it over 90.

Neither is blocking for staging; both are v1.1 polish per M9 notes.

---

## What's blocking staging deploy — strictly items **I (Vidit) need to action**

1. **Get the 5 🔴 blockers from §A6 resolved with Logan/Rejin**: brand/domain (Q-M1-01), DNS (Q-PENDING-03), office address + GSTIN (Q-PENDING-02), named Finance operator (Q-PENDING-04), Cloudinary creds (Q-PENDING-09).
2. **Confirm the Atlas cluster region** — if `dev.gdddmth.mongodb.net` isn't in ap-south-1, we either migrate or provision a fresh one per DEPLOY.md T-24h. BRD BR-11 is load-bearing.
3. **Push to next session (code-owed, not blocker for *verifying* Atlas was wired correctly — blocker for the UI working end-to-end):** wire `deviceId` on web login/refresh/accept-invite (Q-M2-01).

Everything else — render.yaml, DEPLOY.md, sign-job-jwt, cron schedules — is already shipped (M9 commit `c62a3f4`).

---

## Memory checkpoint

- `memory/decisions.md` — appended **D-084** (this session).
- `memory/open-questions.md` — closed Q-M5-06 partial (Atlas provisioned, pending region confirm), added **Q-VERIFY-01** (deviceId not wired on web).
- Commit: `chore(memory): pre-launch verification 2026-04-22`.
