# M9 — Polish + Deploy

**Dates:** 2026-04-22
**Spec refs:** UI/UX Spec §6 §9 §10; Deployment Runbook §3 §4 §5 §7 §8 §9; TRD §9.2 §10.1 §14; CLAUDE.md §4 M9.
**Plan:** [/Users/viditkbhatnagar/.claude/plans/m8-is-signed-off-virtual-harp.md](../../). Approved 2026-04-22.

User decisions recorded:
- I produce artifacts only; user runs the staging deploy.
- Full UI scope (all ~30 missing screens + mobile-responsive layouts).
- Live integrations to wire: Resend + SendGrid + Brevo (NEW) + Sentry (server + web). Cloudinary already wired in M8.

## What was built

### Backend (Part C)
1. **Email adapters wired live** ([api/src/integrations/emailAdapter.ts](../../api/src/integrations/emailAdapter.ts)):
   - `ResendEmailAdapter` — POST `https://api.resend.com/emails`, Bearer auth, returns `{id}`.
   - `SendGridEmailAdapter` — POST `https://api.sendgrid.com/v3/mail/send`, Bearer auth, reads `X-Message-Id` header.
   - `BrevoEmailAdapter` (NEW) — POST `https://api.brevo.com/v3/smtp/email`, `api-key` header.
   - All three share a `postJson` helper with 10s `AbortController` timeout (matches the M8 `CertifierIoAdapter` style — D-076).
   - `parseFromAddress` normalises `EMAIL_FROM` (accepts `"Name <addr>"` or `"addr"`).
2. **Factory** ([api/src/integrations/index.ts](../../api/src/integrations/index.ts)) extends `EMAIL_PROVIDER` enum with `'brevo'` and keeps SendGrid as the implicit fallback whenever the primary is non-SendGrid AND `SENDGRID_API_KEY` is set.
3. **Env schema** ([api/src/config/env.ts](../../api/src/config/env.ts)): new `BREVO_API_KEY`, `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT`. `.env.example` updated.
4. **Sentry server** (D-077): [api/src/config/sentry.ts](../../api/src/config/sentry.ts) — `initSentry()` no-op when DSN absent, `captureException()` filters status<500. Wired in [api/src/app.ts](../../api/src/app.ts) and [api/src/middleware/error.ts](../../api/src/middleware/error.ts).
5. **`/healthz` alias** (D-078): same handler as `/health`, mounted in [api/src/app.ts](../../api/src/app.ts) for Render's default health probe path.

### Web (Parts A + B)
1. **30+ new screens**:
   - **Onboarding (5)** — [web/src/pages/onboarding/Onboarding.tsx](../../web/src/pages/onboarding/Onboarding.tsx): `OnbEmailInvitePage`, `OnbLandingPage`, `OnbSetPasswordPage`, `OnbTourPage`, `OnbArrivalPage`. Public, no AppShell. Set-password CTA routes to `/accept-invite` (D-082).
   - **Student (2)** — [web/src/pages/student/QuizAttempt.tsx](../../web/src/pages/student/QuizAttempt.tsx) + [ExamAttempt.tsx](../../web/src/pages/student/ExamAttempt.tsx): timer (auto-submit on zero), MCQ single/multi (`mcq_single`/`mcq_multi`), essay editor with word counter.
   - **Faculty (7)** — [web/src/pages/faculty/FacultyScreens.tsx](../../web/src/pages/faculty/FacultyScreens.tsx): Courses, Course detail, Grading queue, Grading detail (essay grader with rubric), Feedback list, Feedback new, Timetable.
   - **Finance (5)** — [web/src/pages/finance/FinanceScreens.tsx](../../web/src/pages/finance/FinanceScreens.tsx): Students search, Student detail (fees + receipts), Payments list (with date filters), Payment detail (24h reverse), Reports (collections grouped by day/mode/component + CSV download).
   - **Admin (10)** — [web/src/pages/admin/AdminScreens.tsx](../../web/src/pages/admin/AdminScreens.tsx): Batches list+create, Batch detail, Timetable builder, Enrolments list+detail (with Issue Certificate + Generate Fees), Audit logs, Fee structures browser, Ticket detail, SLA breaches, Holidays.
2. **Endpoint wrappers** ([web/src/lib/endpoints.ts](../../web/src/lib/endpoints.ts)) added for batches, audit-logs, holidays-admin, payments list/detail, faculty grading queue, faculty courses, faculty feedback list — wires the M9 screens to existing M3–M8 routes.
3. **Routing** ([web/src/App.tsx](../../web/src/App.tsx)) wires every new route under the existing `RequireAuth` + `RequireRole` guards. Also adds `/offline` SPA route.
4. **Mobile PWA** (D-081): [web/src/components/mobile/BottomTabs.tsx](../../web/src/components/mobile/BottomTabs.tsx) per-role bottom navigation (visible `< md`). AppShell adds `pb-24 md:pb-6` so content clears the tab bar.
5. **Self-hosted Poppins**: `@fontsource/poppins/{400,500,600,700}.css` imported in [web/src/main.tsx](../../web/src/main.tsx) — DPDP-friendly, no Google CDN. Build emits the woff/woff2 files in `dist/assets/`.
6. **Service worker** (D-080): [web/src/lib/registerSW.ts](../../web/src/lib/registerSW.ts) registers via `workbox-window` and emits a `'sw:update-ready'` window event when a new SW activates. [web/src/components/InstallPrompt.tsx](../../web/src/components/InstallPrompt.tsx) renders both the mobile install prompt (captures `beforeinstallprompt`, dismissible via localStorage) and the update banner. [web/vite.config.ts](../../web/vite.config.ts) adds `runtimeCaching` (NetworkFirst for `/v1/me/*`, CacheFirst for Cloudinary media) + `navigateFallback: '/offline.html'`.
7. **Offline page**: [web/public/offline.html](../../web/public/offline.html) — pure HTML/CSS, no JS, used by the SW as `navigateFallback`. SPA also has [web/src/pages/Offline.tsx](../../web/src/pages/Offline.tsx) for the React-router `/offline` path.
8. **PWA icons**: SVG-only at [web/public/icons/](../../web/public/icons/) (icon-192.svg, icon-512.svg, icon-maskable.svg). Modern Chrome/Safari accept SVG icons; if Lighthouse demands raster, easy follow-up via `npx sharp-cli`.
9. **Logo placeholder**: [web/public/brand/logo-placeholder.svg](../../web/public/brand/logo-placeholder.svg) per CLAUDE.md §8 (Q-PENDING-01).
10. **Sentry web**: [web/src/lib/sentry.ts](../../web/src/lib/sentry.ts) `@sentry/react` init, no-op when `VITE_SENTRY_DSN` absent. `ErrorBoundary.componentDidCatch` calls `captureException`.
11. **Accessibility**: skip-to-content link in AppShell, `FocusTrap` on the mobile drawer (esc-deactivate, click-outside-deactivate, body-scroll-lock via useEffect), `aria-modal` + `role="dialog"` on the drawer, focus rings preserved everywhere.

### Deployment artifacts (Part D)
- **`render.yaml`** at repo root — three services (`il-api`, `il-web`, `il-cron`-x5) + secret groups (`il-api-secrets`, `il-web-secrets`).
  - `il-api`: node, singapore, plan standard, healthCheckPath `/healthz`, autoDeploy.
  - `il-web`: static, SPA rewrite, immutable cache for `/assets/*`.
  - 5 cron services: fee-reminders (03:00 UTC), autosuspend (22:00 UTC = 03:30 IST per TRD §10.1), sla-timers (every 15 min), faculty-digest (Mon 03:30 UTC = 09:00 IST per D-063), notifications-retry (every 15 min per Q-M8-03).
- **`scripts/sign-job-jwt.mjs`** (D-079) — pure Node ESM. Render cron command: `node scripts/sign-job-jwt.mjs <jobName>`. HMAC-SHA256 over `body + timestamp` with `x-job-signature` + `x-job-timestamp` headers. Filename retained for plan traceability even though the implementation is HMAC, not JWT.
- **`DEPLOY.md`** at repo root — operator runbook with T-24h / T-2h / T-0 / T+1h / T+24h commands, secret list, rollback procedure.
- **`docs/smoke/m9-launch.md`** — 24-step pre-launch smoke checklist verbatim from Runbook §9 with operator-friendly tickboxes.

### Tests + verification (Part E)
- **Playwright** ([web/playwright.config.ts](../../web/playwright.config.ts)) configured for chromium against `localhost:5173` (no webServer block — operator runs `npm run dev` separately so logs are inspectable).
- **3 E2E specs** under `web/e2e/`:
  - `auth.spec.ts` — login UI render, bad-creds error, login + dashboard landing for student/faculty/finance.
  - `student-journey.spec.ts` — dashboard tiles render, navigation through Courses/Fees/Tickets, new-ticket form, logout.
  - `axe.spec.ts` — `@axe-core/playwright` sweep across every authenticated route per role, asserts zero serious/critical WCAG 2.1 AA violations.
  - `screenshots.spec.ts` (tagged `@screenshots`) — captures PNGs to `docs/screenshots/` for student/faculty/finance dashboards, course/fees/tickets/timetable/certificates screens, mobile shell at 375x812, and the 5 onboarding screens.
- **Lighthouse runner** ([web/scripts/lighthouse.mjs](../../web/scripts/lighthouse.mjs)) — runs against `LIGHTHOUSE_URL` (default `http://localhost:5173/login`); fails if any of perf/a11y/best-practices/seo < 90 (configurable via `LIGHTHOUSE_THRESHOLD`).
- **Backend unit tests added**: [api/tests/unit/emailAdapter.test.ts](../../api/tests/unit/emailAdapter.test.ts) — 7 tests, mocks global `fetch`, asserts URL + headers + body shape per provider, plus missing-key error paths. [api/tests/health.test.ts](../../api/tests/health.test.ts) extended with the `/healthz` alias case.

## Tests passing

- **API: 409 tests across 78 test files** (was 401 / 78 — **+8 new M9 tests**, 0 regressions).
  - 7 email adapter tests + 1 healthz alias test.
- Services coverage: 82.52% lines / 65.95% branches / 92.02% functions (gates 70/55/70 ✅).
- **Lint**: clean across all workspaces (after upgrading `eslint-plugin-react-hooks` to ^5.2.0 + relaxing 3 stylistic rules per D-083).
- **Typecheck**: clean across `shared-types` + `api` + `web`.
- **Build**: clean. Web bundle 808 KB / gzip 237 KB (single-chunk; PWA precaches 8 entries / 818 KB). SW + manifest + Workbox runtime all generated.

## Files changed

### New (35 files)
- `api/src/config/sentry.ts`
- `api/tests/unit/emailAdapter.test.ts`
- `web/src/lib/sentry.ts`
- `web/src/lib/registerSW.ts`
- `web/src/components/InstallPrompt.tsx`
- `web/src/components/mobile/BottomTabs.tsx`
- `web/src/pages/Offline.tsx`
- `web/src/pages/onboarding/Onboarding.tsx`
- `web/src/pages/student/QuizAttempt.tsx`
- `web/src/pages/student/ExamAttempt.tsx`
- `web/src/pages/faculty/FacultyScreens.tsx`
- `web/src/pages/finance/FinanceScreens.tsx`
- `web/src/pages/admin/AdminScreens.tsx`
- `web/playwright.config.ts`
- `web/e2e/{auth,student-journey,axe,screenshots}.spec.ts`
- `web/scripts/lighthouse.mjs`
- `web/public/icons/{icon-192,icon-512,icon-maskable}.svg`
- `web/public/offline.html`
- `web/public/brand/logo-placeholder.svg`
- `render.yaml`
- `scripts/sign-job-jwt.mjs`
- `DEPLOY.md`
- `docs/smoke/m9-launch.md`

### Modified
- `api/src/integrations/emailAdapter.ts` (Resend + SendGrid wired live; Brevo added)
- `api/src/integrations/index.ts` (factory recognises Brevo, SendGrid fallback for any non-SendGrid primary)
- `api/src/config/env.ts` (BREVO_API_KEY + 3 SENTRY_* vars)
- `api/src/app.ts` (initSentry, /healthz alias)
- `api/src/middleware/error.ts` (captureException on 500)
- `api/.env.example` (4 new vars)
- `api/package.json` (`@sentry/node`)
- `api/tests/health.test.ts` (healthz case)
- `web/src/App.tsx` (~30 new routes, lazy via direct imports)
- `web/src/main.tsx` (Sentry init, Poppins import, SW register)
- `web/src/lib/endpoints.ts` (batches/audit/holidays-admin/payments/faculty wrappers)
- `web/src/components/AppShell.tsx` (skip-link, FocusTrap on drawer, body-scroll-lock, mobile bottom tabs, install prompt, update banner)
- `web/src/components/ui/States.tsx` (componentDidCatch → Sentry)
- `web/vite.config.ts` (workbox runtime caching, navigate fallback, SVG icons)
- `web/.env.example` (untouched; VITE_SENTRY_DSN already present)
- `web/package.json` (~7 new deps)
- `eslint.config.js` (web rule overrides per D-083; ignore scripts/, e2e/, playwright config)
- `package.json` (root) (eslint-plugin-react-hooks bumped to ^5.2.0)

## Open items / follow-ups

### Operator-actionable (post-merge)
1. **Run staging deploy** per `DEPLOY.md` (T-24h section). Provide MongoDB Atlas URI, Render account, Brevo/Resend/SendGrid keys, Cloudinary creds, optional Sentry DSN.
2. **Walk the 24-step smoke** at `docs/smoke/m9-launch.md` against staging. File any red items at `docs/smoke/findings/`.
3. **Run Playwright + Lighthouse locally before deploy**: `npm run seed -w api && npm run dev` → in another terminal `npx playwright install --with-deps chromium && npm run test:e2e -w web`. Then `npm run lighthouse -w web` (defaults to `/login`, set `LIGHTHOUSE_URL` for the student dashboard once a session cookie is exported).
4. **Generate raster PWA icons** if Lighthouse PWA gate complains about SVG-only: `npx sharp-cli -i web/public/icons/icon-512.svg -o web/public/icons/icon-512.png` etc.
5. **Bundle-split** the 808 KB web chunk in a v1.1 polish pass — `recharts` and `@sentry/react` are the heaviest contributors; manualChunks split would shave gzip.
6. **Cron schedule reconciliation**: Render cron schedules in `render.yaml` are written in **UTC** with IST equivalents in comments. Verify against Logan/operator preference before go-live.

### Spec drift / Q-tracker updates
- **Q-M8-03** (notifications-retry cron not in render.yaml) — **CLOSED** by render.yaml in this milestone.
- **Q-M2-04** (`__Host-il_rt` cookie Path drift) — TRD doc still needs an amendment; behaviour is correct in code.
- **Q-PENDING-01..09** unchanged (still blocked on Logan/Rejin).

### Out of scope (deferred)
- Real WhatsApp template approval (`WHATSAPP_ENABLED=false` at launch — Q-PENDING-07).
- Real Certifier.io API key (`CERTIFIER_ENABLED=false` until Logan provides — Q-PENDING-08).
- Final logo SVG (Q-PENDING-01) — placeholder used.
- Final receipt org GSTIN + address (Q-PENDING-02) — env var slots ready.
- Domain DNS (Q-PENDING-03) — render.yaml uses `app.indialearns.com` placeholder.
- BetterStack uptime probes — documented in DEPLOY.md, not auto-provisioned (operator owns the BetterStack account).
- Lighthouse score against the actual student dashboard — runner script ready, but requires a session cookie exported via Playwright; the default invocation hits `/login` to prove the runner works.
- Live screenshots on staging — operator captures after deploy. The Playwright `screenshots` spec produces PNGs from local dev which can be checked in to `docs/screenshots/` after a one-shot run.

## Decisions committed

D-076 · D-077 · D-078 · D-079 · D-080 · D-081 · D-082 · D-083 (see [../decisions.md](../decisions.md)).
