# India Learns — Documentation

This is the operational, security, compliance, legal, end-user, and architectural documentation for the India Learns LMS. It complements the product specification pack in [../claude-code-docs/](../claude-code-docs/), which remains the source of truth for *what* the product must do. The docs in this folder describe *what is built*, *how it operates*, *who can use it and how*, and *what obligations attach to its operation*.

> **Status:** Phase 1 (June internal test → July full launch). Docs reflect implementation as of 26 April 2026 and are reviewed at the end of each milestone.

> **Source-of-truth rule:** if a doc here contradicts the code, the code wins. File paths cited in these docs are checkpoints — please flag drift in a PR.

---

## Reading order by audience

| If you are… | Start here | Then read |
|---|---|---|
| **A new engineer joining the team** | [architecture/system-overview.md](architecture/system-overview.md) | [architecture/data-model.md](architecture/data-model.md) → [security/access-control.md](security/access-control.md) → [operations/on-call-runbook.md](operations/on-call-runbook.md) |
| **An admin running day-to-day operations at LUC** | [user-guides/admin-handbook.md](user-guides/admin-handbook.md) | [user-guides/finance-handbook.md](user-guides/finance-handbook.md), [user-guides/support-channels.md](user-guides/support-channels.md) |
| **A student or faculty member** | [user-guides/quick-start-student.md](user-guides/quick-start-student.md) / [user-guides/quick-start-staff.md](user-guides/quick-start-staff.md) | [user-guides/student-handbook.md](user-guides/student-handbook.md) / [user-guides/faculty-handbook.md](user-guides/faculty-handbook.md), [user-guides/faqs.md](user-guides/faqs.md) |
| **A security reviewer or pentester** | [security/SECURITY.md](security/SECURITY.md) | [security/threat-model.md](security/threat-model.md) → [security/cryptography.md](security/cryptography.md) → [security/pentest-readiness-checklist.md](security/pentest-readiness-checklist.md) |
| **A compliance officer / auditor (DPDP / SOC 2)** | [compliance/dpdp-compliance-report.md](compliance/dpdp-compliance-report.md) | [compliance/ropa.md](compliance/ropa.md) → [compliance/dpia.md](compliance/dpia.md) → [compliance/soc2-readiness-gap-analysis.md](compliance/soc2-readiness-gap-analysis.md) |
| **Legal counsel** | [legal/PLACEHOLDERS.md](legal/PLACEHOLDERS.md) | [legal/privacy-policy.md](legal/privacy-policy.md) → [legal/terms-of-service.md](legal/terms-of-service.md) → [legal/dpa-template.md](legal/dpa-template.md) |
| **An on-call engineer** | [operations/on-call-runbook.md](operations/on-call-runbook.md) | [operations/monitoring-and-alerting.md](operations/monitoring-and-alerting.md) → [operations/backup-and-dr.md](operations/backup-and-dr.md) |

---

## Full document index

### Security ([security/](security/))

| Doc | Purpose | Audience |
|---|---|---|
| [SECURITY.md](security/SECURITY.md) | Public security policy, vulnerability disclosure, scope, safe harbor | External researchers, public |
| [threat-model.md](security/threat-model.md) | STRIDE per trust boundary, mitigations, residual risk | Security reviewers, engineers |
| [access-control.md](security/access-control.md) | Role matrix, suspension semantics, RBAC enforcement points | Auditors, engineers, admins |
| [cryptography.md](security/cryptography.md) | TLS, Argon2id, JWT, cookies, hashing, signed jobs | Auditors, engineers |
| [secrets-management.md](security/secrets-management.md) | Env-var inventory, rotation, leak response | Engineers, ops |
| [secure-sdlc.md](security/secure-sdlc.md) | Branch protection, CI gates, dependency hygiene, code review | Engineers, contributors |
| [incident-response-plan.md](security/incident-response-plan.md) | Severity matrix, playbook, comms tree, breach-notification clock | On-call, ops, leadership |
| [pentest-readiness-checklist.md](security/pentest-readiness-checklist.md) | OWASP ASVS L2 mapping, scope, test accounts | External pentesters |
| [known-issues.md](security/known-issues.md) | Current `npm audit` findings + risk acceptance | Engineers, auditors |

### Compliance ([compliance/](compliance/))

| Doc | Purpose | Audience |
|---|---|---|
| [dpdp-compliance-report.md](compliance/dpdp-compliance-report.md) | Section-by-section DPDP Act 2023 control map | DPDP audits, regulators, legal |
| [dpia.md](compliance/dpia.md) | Data Protection Impact Assessment | DPDP audits, DPO |
| [ropa.md](compliance/ropa.md) | Records of Processing Activities | DPDP audits, DPO |
| [data-classification.md](compliance/data-classification.md) | Data tiers and handling rules | All staff |
| [data-retention-policy.md](compliance/data-retention-policy.md) | Per-collection retention + deletion triggers | DPO, ops, engineers |
| [dsar-procedure.md](compliance/dsar-procedure.md) | Access / correction / erasure / portability workflow | DPO, support staff |
| [vendor-risk-register.md](compliance/vendor-risk-register.md) | Subprocessors with security posture and DPA status | DPO, procurement, auditors |
| [soc2-readiness-gap-analysis.md](compliance/soc2-readiness-gap-analysis.md) | Trust Service Criteria scorecard with evidence | Auditors, leadership |
| [accessibility-statement.md](compliance/accessibility-statement.md) | WCAG 2.1 AA conformance + known gaps | Public, accessibility reviewers |

### Legal ([legal/](legal/))

| Doc | Purpose | Audience |
|---|---|---|
| [PLACEHOLDERS.md](legal/PLACEHOLDERS.md) | Single fill-before-publish checklist for all legal docs | Legal, ops |
| [terms-of-service.md](legal/terms-of-service.md) | User-facing ToS | Public |
| [privacy-policy.md](legal/privacy-policy.md) | User-facing privacy notice | Public |
| [cookie-policy.md](legal/cookie-policy.md) | Cookie usage disclosure | Public |
| [acceptable-use-policy.md](legal/acceptable-use-policy.md) | Prohibited conduct + enforcement | Public, students, staff |
| [refund-policy.md](legal/refund-policy.md) | Refund rules per LUC | Public, students |
| [student-enrollment-agreement.md](legal/student-enrollment-agreement.md) | Student ↔ LUC contract | Students, LUC legal |
| [dpa-template.md](legal/dpa-template.md) | Data Processing Agreement (vendor + B2B reseller variants) | Procurement, legal |

### User guides ([user-guides/](user-guides/))

| Doc | Purpose | Audience |
|---|---|---|
| [student-handbook.md](user-guides/student-handbook.md) | Full walkthrough for students | Students |
| [faculty-handbook.md](user-guides/faculty-handbook.md) | Full walkthrough for faculty | Faculty |
| [admin-handbook.md](user-guides/admin-handbook.md) | Full walkthrough for admin role | LUC admins |
| [superadmin-handbook.md](user-guides/superadmin-handbook.md) | Superadmin-only operations | Vidit, designated LUC superadmin |
| [finance-handbook.md](user-guides/finance-handbook.md) | Payment recording, receipts, collections | Finance staff |
| [quick-start-student.md](user-guides/quick-start-student.md) | One-page student getting-started | New students |
| [quick-start-staff.md](user-guides/quick-start-staff.md) | One-page staff getting-started | New staff |
| [faqs.md](user-guides/faqs.md) | Frequently asked questions, all roles | Everyone |
| [support-channels.md](user-guides/support-channels.md) | How to get help, when, and SLAs | Everyone |

### Operations ([operations/](operations/))

| Doc | Purpose | Audience |
|---|---|---|
| [slas.md](operations/slas.md) | Service-level commitments to LUC | LUC, ops |
| [backup-and-dr.md](operations/backup-and-dr.md) | RPO/RTO, snapshot policy, restore drill | Ops, on-call |
| [monitoring-and-alerting.md](operations/monitoring-and-alerting.md) | Sentry, health checks, alert routing | Ops, on-call |
| [change-management.md](operations/change-management.md) | PR → CI → preview → prod | Engineers |
| [on-call-runbook.md](operations/on-call-runbook.md) | Paging tree + per-alert playbooks | On-call |
| [release-notes-template.md](operations/release-notes-template.md) | Per-release changelog format | Engineers, LUC |

### Smoke checklists ([smoke/](smoke/))

Pre-existing per-milestone manual smoke checklists (`m4-timetable.md` … `m9-launch.md`, plus pre-launch findings). Used during release verification per the [Definition of Done](../CLAUDE.md) §6. Not authored as part of this pack but indexed here for discoverability.

### Architecture ([architecture/](architecture/))

| Doc | Purpose | Audience |
|---|---|---|
| [system-overview.md](architecture/system-overview.md) | C4 context + container view | Engineers, auditors |
| [data-model.md](architecture/data-model.md) | All 39 collections, indices, conventions | Engineers, auditors |
| [api-reference.md](architecture/api-reference.md) | Endpoint catalog from `/api/src/routes/` | Integrators, engineers |
| [integrations.md](architecture/integrations.md) | Adapter pattern, providers, fallbacks | Engineers |
| [adrs/](architecture/adrs/) | Architecture Decision Records | Engineers, future maintainers |

---

## Conventions

- **Markdown only.** Diagrams use Mermaid fenced blocks.
- **File paths are clickable.** All cross-references use relative repo-rooted paths so GitHub and IDE navigation both work.
- **Placeholders use `{{DOUBLE_BRACES}}`.** Every legal doc lists its placeholders in [legal/PLACEHOLDERS.md](legal/PLACEHOLDERS.md). Search for `{{` before publishing.
- **"Last reviewed" dates** appear at the bottom of each doc. Bump the date when content materially changes.
- **Owner** is named at the bottom of each doc. The owner is responsible for keeping it accurate.

---

## Provenance

These docs were assembled by reading the codebase (api/src, web/src, render.yaml, .github/workflows/ci.yml, .env.example) and the spec pack (claude-code-docs/) end-to-end on 26 April 2026. Where the spec and the code disagreed, the code was treated as authoritative and the discrepancy noted in the relevant doc.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar (vendor lead)._
