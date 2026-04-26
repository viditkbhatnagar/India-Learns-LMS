# Release Notes Template

Use this template for every release that affects users or operators. Save released versions at `/docs/release-notes/v<X.Y.Z>.md` (folder created on first release).

---

# Release v{{VERSION}}

**Released:** {{YYYY-MM-DD}}
**Released by:** {{NAME}}
**Commit:** [{{SHA}}](https://github.com/{{ORG}}/{{REPO}}/commit/{{SHA}})

## Summary

_One-paragraph human-readable description of what landed and why. Aim for 3–5 sentences._

## ✨ New

_New features users or operators can use today._

- (e.g.) Added bulk-enrol CSV upload on `/admin/enrollments` so admins can enrol a full batch from a single file.
- ...

## 🛠️ Changed

_Behaviour changes that aren't strictly new features. If a workflow looks different, list it here._

- (e.g.) `/finance/students/:id/record-payment` now defaults the allocation to oldest-instalment-first; old behaviour required manual selection.
- ...

## 🐞 Fixed

_Bug fixes that users would notice._

- (e.g.) Fixed timetable override applying to the wrong batch when two batches shared a slot.
- ...

## 🔒 Security

_Anything security-relevant. If a CVE or finding was addressed, reference it (without exploit detail)._

- (e.g.) Tightened query-param validation on `/v1/users` listing.
- ...

## 🧹 Operational

_Changes that affect operators only — env vars, deploy steps, cron schedules, etc._

- (e.g.) Added env var `NOTIFICATIONS_RETRY_MAX` (default 3).
- ...

## 📦 Migrations and breaking changes

_Anything that requires a manual step or might break callers/integrations._

- (e.g.) Index `auditLogs.actorUserId+at` re-built; expect 30s of slow queries during deploy on initial run.
- ...

## ⚠️ Known issues

_Issues you're aware of and shipping anyway. Cross-link to [../security/known-issues.md](../security/known-issues.md) if relevant._

- (e.g.) Mobile Safari < 17 may flicker on the dashboard's KPI cards. Tracked as issue #N.

## 🧪 Verification

_What was tested before release._

- [ ] CI green
- [ ] Smoke test: login as a UAT student, navigate dashboard, view a course, raise a ticket
- [ ] Smoke test: login as finance, record a payment on a UAT student
- [ ] `/healthz` returns 200 with new commit SHA
- [ ] Sentry has no new error groups in the 30 min after deploy

## 📝 Notes for LUC

_Anything Logan / Rejin should be aware of._

- (e.g.) If finance staff ask about the new allocation default, point them to the [Finance handbook](../user-guides/finance-handbook.md) §3.1.

---

## Filling out the template

- **Be specific.** "Improved performance" is not a useful note. "Reduced /admin/enrollments list latency from 1.2s to 200ms by adding the `(batchId, status)` compound index" is.
- **Use links.** Cross-reference any updated handbook sections, related ADRs, or known-issue entries.
- **One section per category.** Empty sections can be omitted, but keep the order so future readers find what they expect.
- **Include the test plan.** Even one bullet documenting "I logged in and clicked X" beats nothing.

## When NOT to write release notes

- Pure docs-only commits (these PRs).
- Internal refactors with no user or operator impact.
- Test-only commits.

For any user-facing or operator-facing change, write notes — even short ones.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per quarter; this template evolves as we learn what's missing from past notes._
