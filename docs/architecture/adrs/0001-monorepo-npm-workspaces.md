# ADR 0001 — Monorepo with npm workspaces

**Status:** Accepted
**Date:** 2026-02-01 (codified in `CLAUDE.md` at project bootstrap)
**Author:** Vidit Bhatnagar

## Context

India Learns has a TypeScript backend (`api/`), a TypeScript frontend (`web/`), and shared DTO types that both sides need to agree on. We had three options:

1. **Two repos** with shared types published to a registry.
2. **Monorepo with a heavy tool** like Nx or Turborepo.
3. **Monorepo with native npm workspaces.**

## Decision

Use a **single repository with npm workspaces**:

```
india-learns/
├─ api/                    # Express backend
├─ web/                    # React frontend
├─ packages/
│  └─ shared-types/        # DTOs, enums, adapter interfaces
├─ scripts/                # repo-wide scripts
└─ package.json            # workspaces declaration
```

Root scripts orchestrate the workspaces (`npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`).

## Rationale

- **Shared types stay in lockstep.** A breaking change to a DTO must update both api and web in the same PR — workspaces enforce this naturally; two-repo would allow drift.
- **Single CI pipeline.** [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) lints, typechecks, tests, builds across all workspaces in one run.
- **Single deploy unit.** Render runs `npm ci --include=dev && npm run build` and starts `node api/dist/index.js` — same-origin deploy serves both API and SPA from one process. See [system-overview.md](../system-overview.md) §2.
- **No new tool to learn.** npm workspaces are stock; Nx/Turbo would add value for >3 workspaces or hot reloading, neither of which we need.

## Consequences

**Good:**

- Faster iteration — change a type, both sides see it immediately.
- One `npm install` for the whole repo.
- One `package-lock.json` to keep secure.
- CI is simpler.

**Trade-offs:**

- One slow workspace slows everyone's CI. Acceptable at our size.
- Versioning shared-types as `*` ties everything to repo HEAD; if we ever publish shared-types externally we'll need real versions.

## Alternatives considered

- **Two repos.** Rejected because shared-type drift is a guaranteed source of bugs and our team is small.
- **Nx / Turbo.** Rejected because the speedups don't pay back at our size, and they add a layer of abstraction that surprises new contributors.

## References

- [`package.json`](../../../package.json) — workspaces declaration.
- [`CLAUDE.md`](../../../CLAUDE.md) §5 — repo layout convention.
