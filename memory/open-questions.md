# Open questions — India Learns LMS

Anything blocked on Logan / Vidit / external input. Reference Q-numbers when raising with stakeholders.

---

## Q-M1-01 — Brand name: "India Learns" or "India LearnHub"?
**Raised:** 2026-04-21 (M1)
**Owner:** Logan
**Context:** `claude-code-docs/CLAUDE.md`, `01_BRD.md`, `03_TRD.md`, `04_UI_UX_Spec.md` all say "India Learns" with `app.indialearns.com`. Root `/CLAUDE.md` and `PROMPTS.md` (some sections) say "India LearnHub" with `app.indialearnhub.com`. M1 implementation uses "India Learns" per source-of-truth hierarchy. Need confirmation before M9 deploy + DNS purchase.
**Impact if wrong:** Trivial fix (UI copy + `<title>` + env defaults), but affects domain registration — must be locked before M8/M9.

## Q-PENDING-01 — Official India Learns logo SVG
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Logan / Rejin.
**Workaround:** Brand-color placeholder SVG generated from `#F58220` + `#1A3A8F`.

## Q-PENDING-02 — Registered office address + GSTIN for receipts
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Rejin (LUC entity legal info).
**Workaround:** `RECEIPT_ORG_ADDRESS=PENDING`, `RECEIPT_ORG_GSTIN=""` in `.env.example`. Receipts will print "PENDING" until set.

## Q-PENDING-03 — Domain DNS for `app.indialearns.com` + `api.indialearns.com`
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Rejin.
**Workaround:** Build assumes the domain; Render config will parameterise it in M9.

## Q-PENDING-04 — Finance operator (Logan Q12)
**Source:** BRD §4.
**Owner:** Logan.
**Workaround:** Finance role permissions + UI built without a named human. UAT delayed until owner is named.

## Q-PENDING-05 — Content manager (Logan Q12)
**Source:** BRD §4.
**Owner:** Logan.
**Workaround:** Course/module CRUD built; first content batch waits on owner.

## Q-PENDING-06 — IT/System admin
**Source:** BRD §4.
**Owner:** Logan / Rejin.
**Workaround:** Technical ticket queue routes to Admin role until IT admin is named.

## Q-PENDING-07 — Meta WABA template approval
**Source:** Root `/CLAUDE.md` §8, TRD §9.3.
**Owner:** LUC ops.
**Workaround:** `WhatsAppService.sendTemplate()` is a no-op logger in dev. Toggle via `WHATSAPP_ENABLED=true` once Meta approves the three templates.

## Q-PENDING-08 — Certifier.io API key
**Source:** Root `/CLAUDE.md` §8.
**Owner:** Logan / Vidit.
**Workaround:** Stub adapter issues a fake URL in dev (`CERTIFIER_ENABLED=false`).
