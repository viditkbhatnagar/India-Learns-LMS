# India-Learns-LMS

LMS for LUC's in-person 300-hour Diploma Programs in India (Aviation, Retail & Fashion). Phase 1 — June internal test, July 2026 launch.

Spec pack: [`claude-code-docs/`](claude-code-docs/). Read [`claude-code-docs/CLAUDE.md`](claude-code-docs/CLAUDE.md) first. Build script: [`PROMPTS.md`](PROMPTS.md). Live task list: [`TASKS.md`](TASKS.md). Cross-session memory: [`memory/`](memory/).

## Stack

Node 20 LTS · TypeScript 5.4 (ESM) · Express 4 · Mongoose 8 · MongoDB 7 (Atlas, Mumbai) · React 18 · Vite 5 · Tailwind 3 · vite-plugin-pwa · React Router 6.

## Layout

```
api/                      # Express backend
web/                      # React frontend (PWA)
packages/shared-types/    # DTOs shared across api + web
claude-code-docs/         # spec pack (read-only)
webapp/, mobile/          # approved JSX mockups (port from, do not redesign)
memory/                   # cross-session context
```

## Quick start

```bash
nvm use                   # 20.12.2
npm install               # installs all workspaces
cp api/.env.example api/.env
cp web/.env.example web/.env
npm run dev               # api on :4000, web on :5173
```

Health check: `curl http://localhost:4000/health` → `{ ok: true, commit, uptimeSec, ts }`.

## Common commands

| Purpose | Command |
|---|---|
| Install everything | `npm install` |
| Dev (both) | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Test | `npm test` |
| Build | `npm run build` |
| Format | `npm run format` |

Per-workspace: `npm run dev -w api`, `npm run dev -w web`.

## License

Proprietary — © 2026 LUC / India Learns. All rights reserved.
