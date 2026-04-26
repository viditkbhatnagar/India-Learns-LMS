# Change Management

How a code change moves from a developer's machine to production, what gates it passes through, and how we roll back when something goes wrong.

This complements [../security/secure-sdlc.md](../security/secure-sdlc.md) — that doc focuses on the security checklist for the change; this one focuses on the release pipeline and the operational discipline.

## 1. Pipeline

```
Local dev  →  Branch push  →  GitHub Actions CI  →  Pull request  →  Approval  →  Merge to main  →  Render auto-deploy  →  Health check  →  Live
```

Each stage:

| Stage | What happens | Owner |
|---|---|---|
| Local dev | Implementation + tests + manual smoke | Author |
| Branch push | Triggers CI on the branch | GitHub Actions |
| CI | Lint + typecheck + test + build | GitHub Actions |
| Pull request | Reviewer reads the diff and applies the [secure-sdlc.md](../security/secure-sdlc.md) §5 checklist | Reviewer |
| Approval | Reviewer approves or requests changes | Reviewer |
| Merge to main | Squash-merge, conventional-commit message | Author |
| Render auto-deploy | `autoDeploy: true` triggers a build → deploy | Render |
| Health check | `/healthz` must return 200 within Render's window | Render |
| Live | Traffic cuts over | Render |

## 2. Branch and commit conventions

| Branch prefix | Purpose |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation-only (this PR series uses this) |
| `ops/` | Operational change (CI, render.yaml, scripts) |
| `chore/` | Dependency bumps, lint fixes, refactors |
| `polish/` | UI polish (M9-style) |

Commit messages follow Conventional Commits where reasonable:

```
type(scope): summary

Body explains the why if non-obvious.
```

Examples (from `git log` of this repo): `fix(curriculum-import): dedup step10/step11/step12`, `docs(uat): split findings template`.

## 3. Pull request requirements

- **Description** — what changed and why; link to any related discussion.
- **Diff scope** — keep PRs focused; large mixed PRs should be split.
- **Verification** — list manual tests run.
- **CI** — must be green before merge.
- **Reviewer** — at least one human approval.
- **Memory updates** — any decision worth remembering goes into `memory/decisions.md` (per [CLAUDE.md](../../CLAUDE.md) §10) in the same PR.

## 4. CI gates

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

1. `npm ci` — exact lockfile install.
2. `npm run lint` — ESLint + Prettier checks.
3. `npm run typecheck` — `tsc --noEmit` across workspaces.
4. `npm test` — Vitest suite.
5. `npm run build` — full monorepo build.

Concurrency cancels stale runs. Total budget 15 min.

## 5. Deploy windows

Render auto-deploys from `main`. To control deploy timing:

- **Avoid mid-class hours** (typically 10:00–12:00 IST and 14:00–16:00 IST). A deploy mid-class can disrupt active sessions.
- **Avoid Friday 16:00 onward IST** — limited support coverage on weekends. Plan risky changes for Mon–Wed.
- **Avoid finance peak windows** (start/end of month) for any change touching `paymentService`, `receiptService`, or fee calculations.

When a deploy must happen during a sensitive window, post a heads-up to LUC ops first.

## 6. Rollback

Render keeps a deploy history. To roll back:

1. Render dashboard → `il-app` → Deploys → select the last good deploy → **Redeploy**.
2. Watch the build → activate.
3. Confirm `/healthz` returns the rolled-back commit hash.
4. If the change introduced a DB migration, **migration rollback is not automatic** — review the change set and reverse-migrate manually if needed.
5. Cron services do not auto-redeploy with the web service rollback. If the bug is in a cron handler, redeploy each cron from its prior commit.
6. Open an incident document if the rollback was unplanned per [../security/incident-response-plan.md](../security/incident-response-plan.md) §6.

## 7. Database migrations

Phase 1 uses Mongoose — schema is loose, but practical migrations happen via:

- New fields added with defaults — safe to deploy without prior migration.
- Renames or shape changes — require a migration script. Tracked in `api/scripts/`.
- Index adds — Mongoose creates indexes on connect; large new indexes can be slow on first deploy. For non-trivial cases, build the index in the background via the Atlas UI first, then deploy.

When in doubt:

1. Add the new field/index alongside the old one.
2. Backfill via a script.
3. Cut over the read/write path.
4. Remove the old field in a later release.

## 8. Feature flags

We do **not** currently use a feature-flag library. Toggles live as env vars:

- `INTEGRATIONS_MODE` — global stub override.
- `WHATSAPP_ENABLED` / `CERTIFIER_ENABLED` — per-integration.
- `EMAIL_PROVIDER` / `STORAGE_PROVIDER` — per-vendor.
- `RATE_LIMITS_DISABLED` — test-only.

Flipping a flag requires a Render redeploy. For more granular flags (e.g., enable a feature for a single batch), introduce a flag library in Phase 2.

## 9. Communicating changes

| Audience | What | When |
|---|---|---|
| LUC ops (Logan, Rejin) | Notable releases, breaking changes | Before merge |
| Faculty / admin | UI changes that affect daily flow | Day-of via in-app announcement |
| Students | Outage notice, new features that affect them | As needed |

Changelog entries land in `docs/operations/release-notes-template.md` instances at `/docs/release-notes/<tag>.md` (folder created on first formal release).

## 10. Hotfixes

A hotfix is a fix urgent enough to bypass normal cadence — for example, a bug that's losing money or exposing data.

1. Branch from `main` as `fix/<short-name>`.
2. Fix + minimal test that pins the regression.
3. Open PR with `[HOTFIX]` prefix in the title.
4. Get one reviewer approval.
5. Merge.
6. Watch deploy to staging if applicable, then production.
7. Post-deploy: file the incident timeline + post-mortem if the bug had production impact.

Do **not** skip CI even for hotfixes — type errors and lint errors at 03:00 are how compounding bugs get shipped.

## 11. Dependencies

Per [../security/secure-sdlc.md](../security/secure-sdlc.md) §6:

- Adding a new dependency requires a `DEPENDENCY_REQUEST.md` PR per [CLAUDE.md](../../CLAUDE.md) §3.
- Updates are reviewed monthly. Security advisories are reviewed weekly.
- Pin lockfile; never delete-and-regenerate without diff review.

## 12. Configuration changes

Changes to:

- `render.yaml` — full PR review; redeploy required.
- Render secret group (`il-app-secrets`) — Vidit-only; document in `TASKS.md` or an audit comment.
- Atlas configuration — Vidit-only; document.
- DNS — when production domain is provisioned, DNS changes require Logan + Vidit.

## 13. Where to read more

- [../security/secure-sdlc.md](../security/secure-sdlc.md) — security side of the same pipeline.
- [release-notes-template.md](release-notes-template.md) — per-release changelog format.
- [on-call-runbook.md](on-call-runbook.md) — what to do when a deploy goes wrong.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: quarterly._
