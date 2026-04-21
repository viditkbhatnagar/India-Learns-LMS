# Decisions — India Learns LMS

Append-only log. Every entry: ID, date, decision, why, source.

---

## D-001 — Brand name is "India Learns" (not "India LearnHub")
**Date:** 2026-04-21
**Why:** Spec pack (`claude-code-docs/CLAUDE.md`, `01_BRD.md`, `03_TRD.md`, `04_UI_UX_Spec.md`) uniformly says "India Learns" + `app.indialearns.com`. Root `/CLAUDE.md` says "India LearnHub" + `app.indialearnhub.com`. The GitHub repo is `India-Learns-LMS`. Source-of-truth hierarchy (TRD > PRD > BRD > UI/UX > root CLAUDE.md) resolves to "India Learns".
**Source:** TRD §1 line 3, BRD §1 line 3, UI/UX §1. Contradiction vs `/CLAUDE.md` §1.
**How to apply:** Use "India Learns" in all UI copy, `<title>`, env defaults (`WEB_ORIGIN=https://app.indialearns.com`). Flagged in [open-questions.md](open-questions.md) Q-M1-01 for Logan to confirm before M9 go-live.

## D-002 — Health endpoint at `GET /health` for M1
**Date:** 2026-04-21
**Why:** PROMPTS.md M1 DoD and root `/CLAUDE.md` §4 say `/health`. TRD §14 says `/healthz` + `/readyz`. For M1 the milestone prompt is binding; `/healthz` + `/readyz` get added in M9 deploy prep.
**Source:** PROMPTS.md M1, root `/CLAUDE.md` §4 step 3.
**How to apply:** Implement `GET /health` returning `{ ok, commit, uptimeSec, ts }`. Do **not** also add `/healthz`/`/readyz` now.

## D-003 — API port = 4000 in dev
**Date:** 2026-04-21
**Why:** PROMPTS.md DoD says port 4000. TRD §12 has `PORT=10000` (Render's default). Env schema accepts any port; default 4000 for local dev, Render injects its own in prod.
**Source:** PROMPTS.md DoD, TRD §12.
**How to apply:** `api/.env.example` defaults `PORT=4000`. Zod parses as number, no hard constraint.

## D-004 — Repo dir stays `INDIA-LEARNS-LMS`; package name `india-learns`
**Date:** 2026-04-21
**Why:** TRD §2 shows `india-learns/`, root CLAUDE.md §5 shows `india-learnhub/`. Actual on-disk path is `INDIA-LEARNS-LMS` and GitHub repo matches. No value in renaming the directory.
**Source:** TRD §2, filesystem.
**How to apply:** Root `package.json` `"name": "india-learns"`. Keep dir name as-is.

## D-005 — Locked stack (from TRD §3)
**Date:** 2026-04-21
**Why:** Stack is locked in TRD §3 and root CLAUDE.md §3. Node 20.12 LTS, MongoDB 7 on Atlas (AWS ap-south-1), TypeScript 5.4, ESM throughout, npm 10 workspaces. Auth: Argon2id + `jose` (not bcrypt, not jsonwebtoken). Dates: `date-fns` + `date-fns-tz` (not Moment). Money: integer paise.
**Source:** TRD §3.1–3.4, root `/CLAUDE.md` §3, §5.
**How to apply:** Any new dependency not in TRD §3.2/§3.3 requires a `DEPENDENCY_REQUEST.md` at repo root per TRD §3.4.

## D-006 — Monorepo shape: `api/`, `web/`, `packages/shared-types/`
**Date:** 2026-04-21
**Why:** TRD §2 + root CLAUDE.md §5. Shared types live in `packages/shared-types` and are imported by both `/api` and `/web` to prevent DTO drift.
**Source:** TRD §2.
**How to apply:** Workspace name `india-learns-shared-types`. Ship source-only (no build step) — consumers resolve `.ts` directly via TS + tsx + Vite.

## D-007 — WhatsApp templates at launch: three only
**Date:** 2026-04-21
**Why:** TRD §9.3 specifies `il_fee_due`, `il_payment_received`, `il_ticket_update`. Others require Meta pre-approval and are out of scope for Phase 1.
**Source:** TRD §9.3.
**How to apply:** `WhatsAppService.sendTemplate()` supports only these three template names; stub logger in dev; `WHATSAPP_ENABLED=false` default.

## D-008 — Complaint ticket precondition is stricter than BRD wording
**Date:** 2026-04-21
**Why:** A Complaint may only be filed if the student has a prior Resolved or Closed ticket (escalation-only). Server enforces and returns `COMPLAINT_PRECONDITION_UNMET`.
**Source:** BRD BR-06, TRD §8 error code table, TRD §6 `ticketService`.
**How to apply:** `ticketService.create()` runs the precondition check before persisting.

## D-009 — No AI features in Phase 1
**Date:** 2026-04-21
**Why:** BRD §6.2 explicitly defers AI flashcards, voice AI, AI quiz generation, live-class scheduling, and payment gateways. Root CLAUDE.md §7 reinforces.
**Source:** BRD §6.2, root `/CLAUDE.md` §7.
**How to apply:** Do not add these even if tempting. If Logan requests mid-build, spec it through `product-management:write-spec` first.

## D-010 — ESLint config strategy
**Date:** 2026-04-21
**Why:** Root CLAUDE.md §5 says "airbnb-base + @typescript-eslint". ESLint 9 flat config is the default in 2026, but `eslint-config-airbnb-base` has not yet shipped a flat-config build. Use `@eslint/eslintrc`'s `FlatCompat` to pull airbnb-base in as a legacy preset, then layer `typescript-eslint`'s flat config on top. Not blocking; swap to pure-flat (`@antfu/eslint-config` or `eslint-config-standard`) is a one-file change if requested.
**Source:** Root `/CLAUDE.md` §5 + current npm ecosystem state.
**How to apply:** Root `eslint.config.js` uses `FlatCompat`. Devdeps include `@eslint/eslintrc`, `eslint-config-airbnb-base`, `eslint-plugin-import`, `typescript-eslint`.

## D-011 — PWA service worker disabled in dev until M9
**Date:** 2026-04-21
**Why:** `vite-plugin-pwa` in dev mode can cache stale assets and confuse hot reload. M1 only needs the manifest to prove the plugin is wired. Full SW + offline fallback lands in M9 polish (per root CLAUDE.md §4 M9 step 29).
**Source:** Root `/CLAUDE.md` §4 M9.
**How to apply:** `vite-plugin-pwa` registered with manifest + `registerType: 'prompt'` + `injectRegister: false`. `VITE_ENABLE_PWA=true` env flag stays for M9 to flip.
