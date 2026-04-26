# Secure SDLC

How code gets from a developer's laptop to production at India Learns, and the security controls applied at each stage.

## 1. Pipeline overview

```
local edit → branch push → GitHub Actions CI (lint + typecheck + test + build)
            ↓ if green
        pull request → reviewer approval (mandatory) → squash-merge to main
            ↓
        Render auto-deploy from main (autoDeploy: true in render.yaml)
            ↓
        Healthcheck on /healthz → traffic cut over → cron jobs redeploy
```

## 2. Source control

- **Repository:** private GitHub repo (single).
- **Default branch:** `main` — protected (see §3).
- **Working branches:** prefix-coded — `feat/`, `fix/`, `docs/`, `ops/`, `polish/`. Anything destructive should land on a `chore/` or named branch and be flagged in the PR description.
- **Commit signing:** *recommended*. `git config commit.gpgsign true` if you have a GPG/SSH key configured. This is not currently enforced; it is a Phase-2 hardening.

## 3. Branch protection (target settings on `main`)

These are not yet codified in `.github/settings.yml` — once configured, they should be:

| Rule | Setting |
|---|---|
| Require pull request before merging | ✅ |
| Required approvals | **1** (Vidit or designated reviewer) |
| Dismiss stale approvals on new commits | ✅ |
| Require status checks to pass | ✅ — `CI / build` |
| Require branches to be up to date | ✅ |
| Require conversation resolution before merging | ✅ |
| Require linear history | ✅ — squash-merge default |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |
| Restrict who can push to matching branches | Vidit + Logan |

Until these rules are configured at the repository level, this list is the contract reviewers enforce by hand.

## 4. CI gates

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs on every push and pull request to `main`. Stages, in order, all blocking:

1. **`npm ci`** — exact-version install across the workspaces.
2. **`npm run lint`** — ESLint across `api/` and `web/`. Failures block the merge.
3. **`npm run typecheck`** — `tsc --noEmit` across all workspaces. Type errors block the merge.
4. **`npm test`** — Vitest across all workspaces (api unit + service tests; web has Playwright e2e under a separate command).
5. **`npm run build`** — full monorepo build, mirrors what Render runs.

Concurrency is per-ref so an in-flight CI on the same branch is cancelled when a newer push lands. Total budget: 15 minutes.

What CI does **not** yet run (planned hardening):

- `npm audit --audit-level=high` — see [known-issues.md](known-issues.md) for the deferred warning items.
- `markdownlint` for `/docs/**/*.md`.
- A secrets-detector pass (e.g., `gitleaks`).
- An OWASP-ZAP baseline scan against a Render preview environment.

## 5. Code review checklist

Reviewers should walk this list for any PR that touches `api/src/routes/`, `api/src/middleware/`, `api/src/services/`, or any model:

### 5.1 AuthN / AuthZ

- [ ] Every new route either mounts `requireAuth` + `requireRole(...)` or has a justification comment for why it's public.
- [ ] If the route exposes a user-scoped resource, the service queries with `userId === req.auth.userId` (or equivalent owner check).
- [ ] If the new route should be reachable when fees-suspended, both [`api/src/middleware/auth.ts:feesSuspensionAllowed`](../../api/src/middleware/auth.ts) AND [`api/src/middleware/requireNotSuspended.ts:isWhitelisted`](../../api/src/middleware/requireNotSuspended.ts) were updated.

### 5.2 Input validation

- [ ] Body for POST/PATCH/PUT goes through a `zod` schema and `.parse(req.body)`.
- [ ] Path params used as ObjectIds are validated (`Types.ObjectId.isValid` or zod `z.string().regex(/^[a-f0-9]{24}$/i)`).
- [ ] Query params for filtering or pagination accept only known keys.

### 5.3 Audit

- [ ] Every staff write (admin/superadmin/finance/faculty) calls `recordAudit(...)` with a known `AuditAction` code.
- [ ] Audit `before`/`after` snapshots run through `scrubUser` if they include user objects.

### 5.4 Secrets and logs

- [ ] No new secret appears in `.env.example` with a real value.
- [ ] No `console.log(req.body)` or full-object dumps containing PII.
- [ ] No password, hash, or token fields logged anywhere.

### 5.5 Tests

- [ ] At least one Vitest test for the new service function (happy path).
- [ ] At least one route test (in `api/tests/`) for the new endpoint covering: success, unauthenticated, wrong role, validation failure.
- [ ] If the route returns user data, a test confirms it does NOT include `passwordHash` or other scrubbed fields.

### 5.6 Frontend

- [ ] No `dangerouslySetInnerHTML` unless the content is known-safe and explicitly marked.
- [ ] No access token persisted to `localStorage` or `sessionStorage`.
- [ ] No new third-party `<script>` or `<iframe>` without security review.

## 6. Dependencies

- **Allowed dependencies** are listed in [`../../claude-code-docs/03_TRD.md`](../../claude-code-docs/03_TRD.md) §3.4. Adding a new one requires a `DEPENDENCY_REQUEST.md` PR per [CLAUDE.md](../../CLAUDE.md) §3.
- **Update cadence:** monthly review of `npm outdated`. Security advisories (`npm audit`) reviewed weekly during the build phase, more frequently after public CVE alerts.
- **Lockfile:** `package-lock.json` committed. Never delete-and-regenerate without reading the diff.
- **Known issues:** see [known-issues.md](known-issues.md) for currently-accepted findings.

## 7. Pre-deploy checks (manual)

Before merging anything that could affect auth, fees, certificates, or audit:

1. Read the diff one more time.
2. Run the [`security-review` skill](../../CLAUDE.md) on the branch (`/security-review`) — non-negotiable on auth, fees, and ticket modules per CLAUDE.md §11.
3. Check the deploy log on Render after the green CI; verify `/healthz` returns `ok: true` and the new `commit` hash.
4. For auth or fees changes: log in as a real student account and try the previously-broken flow.

## 8. Post-deploy checks

- Tail the production Pino log for 5 minutes after a non-trivial deploy. Alert on any spike of 5xx or `audit.write_failed`.
- Watch Sentry for new error groups in the next 30 minutes.
- For finance changes: smoke-test a real payment record + receipt download on a staging tenant.

## 9. Rollback

Render's deploy history allows redeploying any prior commit. To roll back:

1. Render dashboard → `il-app` → Deploys → select last good deploy → Redeploy.
2. The cron jobs continue using the same secret group, so they remain on the new code unless redeployed too. If the rollback affects cron handlers, redeploy each cron (UI-driven).
3. Open an incident if the rollback was unplanned, per [incident-response-plan.md](incident-response-plan.md).

## 10. Continuous improvements

Gaps tracked for the next hardening window:

- Branch protection rules formalised (`.github/settings.yml`).
- `npm audit --audit-level=high` enforcement in CI (currently only fail on direct dependency issues).
- Secrets-detector (`gitleaks`) as a pre-receive or CI check.
- Renovate / Dependabot for dependency PRs.
- SBOM generation per release.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per quarter and on every CI pipeline change._
