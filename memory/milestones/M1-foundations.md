# M1 — Foundations

**Date completed:** 2026-04-21
**Initial commit:** `1c5d941` — `chore: scaffold monorepo`
**CI run (green):** https://github.com/viditkbhatnagar/India-Learns-LMS/actions/runs/24719414240

## What was built

Bare monorepo skeleton, no business logic.

- **Workspaces:** `api/`, `web/`, `packages/shared-types/` (npm workspaces).
- **Stack pinned:** Node 20.12 LTS, TypeScript 5.4, ESM throughout.
  - `api/`: express 4.19 · mongoose 8.5 · zod 3.23 · pino 9 · pino-http 10 · helmet 7 · cors 2 · nanoid 5. Tests via vitest 1.6 + supertest 7 + mongodb-memory-server 9.
  - `web/`: react 18.3 · react-router-dom 6.26 · vite 5.3 · tailwindcss 3.4 · vite-plugin-pwa 0.20 · @vitejs/plugin-react 4.
  - `packages/shared-types/`: source-only TS package, no build step. Currently exports `HealthResponse`.
- **Tooling:** ESLint 9 flat config (airbnb-base via `FlatCompat` + `typescript-eslint` v8 + Prettier), `.editorconfig`, `.nvmrc` (20.12.2), `.prettierrc.json`.
- **Env:** `api/.env.example` covers the full TRD §12 list; `web/.env.example` covers TRD web vars. Zod-validated on boot via `api/src/config/env.ts`.
- **API skeleton:** `helmet` → `cors` → `pino-http` → `requestId` → `express.json()` → `GET /health` → 404 + error envelope. Mongo connection is *skipped* if `MONGODB_URI` is empty (dev convenience).
- **Web skeleton:** `App.tsx` renders a "Hello India Learns" landing card on the brand cream/navy palette, wrapped in `<BrowserRouter>` so M2 can drop in `/login` immediately. PWA plugin registered with manifest only — service worker disabled in dev (per D-011).
- **CI:** `.github/workflows/ci.yml` runs `npm ci → lint → typecheck → test → build` on every push, Node 20.12.2 pinned via `setup-node@v4`, with `GIT_SHA=${{ github.sha }}` injected.
- **Memory:** `/memory/` populated with index, decisions (D-001..D-011), people (BRD §4 stakeholders + 4 PENDING owners), glossary, open-questions (Q-M1-01 + 7 PENDING items). `/TASKS.md` lists all M1–M9 milestones.

## Tests passing

- `api/tests/health.test.ts` — 2/2:
  - `GET /health` → 200 with `{ ok, commit, uptimeSec, ts }`
  - `GET /does-not-exist` → 404 with `{ error: { code: 'NOT_FOUND', ... } }` envelope

## Files created (key set)

- Root: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.npmrc`, `.editorconfig`, `.nvmrc`, `README.md`, `TASKS.md`
- CI: `.github/workflows/ci.yml`
- Memory: `memory/index.md`, `memory/decisions.md`, `memory/people.md`, `memory/glossary.md`, `memory/open-questions.md`, `memory/milestones/M1-foundations.md`
- shared-types: `packages/shared-types/{package.json,tsconfig.json,src/{index.ts,health.ts}}`
- api: `api/{package.json,tsconfig.json,vitest.config.ts,.env.example,src/{index.ts,app.ts,config/{env.ts,db.ts,logger.ts},middleware/{requestId.ts,error.ts}},tests/health.test.ts}`
- web: `web/{package.json,tsconfig.json,tsconfig.node.json,vite.config.ts,tailwind.config.ts,postcss.config.js,index.html,.env.example,src/{main.tsx,App.tsx,index.css,vite-env.d.ts},public/favicon.svg}`

## Decisions worth re-reading next session

See [`../decisions.md`](../decisions.md) D-001 through D-011. Quick recap:

- **D-001** Brand = "India Learns" (not "India LearnHub"). Root `/CLAUDE.md` is the outlier; flagged as Q-M1-01 for Logan.
- **D-002** Health endpoint = `/health` (not `/healthz`/`/readyz`); add the latter in M9.
- **D-003** API port = 4000 (dev), env-overridable.
- **D-010** ESLint 9 + airbnb-base via `FlatCompat`; required `.npmrc` with `legacy-peer-deps=true` because airbnb-base + typescript-eslint v7 still peer-pin ESLint 8. CI uses the same `.npmrc` so it's consistent.
- **D-011** PWA service worker disabled in dev; flip in M9.

## Surprises during M1

1. **airbnb-base hasn't shipped a flat-config build** — known ecosystem-transition issue. `FlatCompat` + `legacy-peer-deps=true` resolves it cleanly. If a future session wants pure-flat, swap to `@antfu/eslint-config` or `eslint-config-standard` (one-file change).
2. **`pino-http` v10 default-export shape** — `import pinoHttp from 'pino-http'` typed as namespace under NodeNext + esModuleInterop. Switched to named import `import { pinoHttp } from 'pino-http'` (the package re-exports both).
3. **TS project references were fragile across the workspace** — `composite: true` on shared-types required pre-built `dist/` even with `noEmit` consumers. Dropped references; consumers resolve `india-learns-shared-types` via the npm workspace symlink directly to source (`"main": "./src/index.ts"` in shared-types' `package.json`). tsx + Vite + tsc all handle this fine.
4. **Local Node = 24 (engines pin = 20.12)** — npm only warns by default. CI pins Node 20.12.2 via setup-node@v4 (source of truth). Dev experience on Node 24 worked end-to-end for M1, but if M2+ hits native-binary breakage (e.g. `mongodb-memory-server` mongod binary), the user should `nvm install 20.12.2` per `.nvmrc`.

## What the next session needs to know (M2 — Auth)

- The app's middleware order is locked in [`api/src/app.ts`](../../api/src/app.ts). Insert auth middleware between `express.json()` and route mounting. Don't put it before `requestId` — audit logs need `req.requestId`.
- The error envelope helper lives at [`api/src/middleware/error.ts`](../../api/src/middleware/error.ts) — `HttpError` class + `notFound` + `errorHandler`. M2 should use `HttpError(401, 'UNAUTHENTICATED', ...)` etc., per TRD §8 codes.
- Env zod schema is in [`api/src/config/env.ts`](../../api/src/config/env.ts) — already covers JWT_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, JOB_SECRET, login rate-limit knobs. M2 just reads from `loadEnv()`.
- Shared-types is the home for `Role`, `UserStatus`, etc. enums. Add them to `packages/shared-types/src/enums.ts` and re-export from `index.ts`.
- The CI gate is `lint && typecheck && test && build`. Keep it green — the M9 deploy depends on this signal.
- The `/memory/` and `/TASKS.md` flow is mandatory per CLAUDE.md §10. Read them at session start, update them at session end, commit them with the milestone code.

## Open follow-ups (not blocking M2)

- Q-M1-01: Brand name confirmation with Logan (must lock before M9 DNS).
- Move the .docx files in repo root to `claude-code-docs/_history/` if Logan wants the working dir cleaner (cosmetic).
- Consider git-lfs for the two ~1.7 MB standalone HTML mockups if the repo grows. Not needed now.
