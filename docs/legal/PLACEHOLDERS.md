# Legal Placeholders — Pre-Publish Checklist

Every legal document in this folder uses double-brace placeholders for values that depend on the contracting entity, jurisdiction, and operational owners. **Do not publish any legal document until every placeholder is resolved.**

> **Why placeholders?** [CLAUDE.md](../../CLAUDE.md) §8 lists these as pending from Logan / LUC. The legal docs are drafted defensively so that as soon as Logan provides the values, a single search-and-replace makes them publication-ready.

## How to use this checklist

1. Get the values below from Logan and LUC legal counsel.
2. Apply each via search-and-replace across `docs/legal/*.md` AND any other places they appear (e.g., `api/.env.example` for `RECEIPT_ORG_*`).
3. After replacement, grep for `{{` across the legal pack — there should be **zero** matches before publishing.
4. Have LUC legal counsel review the resolved documents.
5. Set the `{{EFFECTIVE_DATE}}` to the date of publication, not the date of drafting.

```
# Verification command (should return zero matches before publish)
grep -rn "{{" docs/legal/
```

## Placeholders inventory

| Token | Type | Example | Who provides | Used in |
|---|---|---|---|---|
| `{{ORG_NAME}}` | Legal entity name of the platform operator | `India Learns Education Pvt Ltd` (TBD) | Logan | All legal docs; receipts; SECURITY.md |
| `{{ORG_REGISTERED_ADDRESS}}` | Full registered address | _Pending_ | Logan | ToS; Privacy; Receipts; DPA |
| `{{ORG_GSTIN}}` | GST identification number | _Pending_ | Logan | Receipts; ToS |
| `{{ORG_CIN}}` | Corporate Identification Number (if Indian Pvt Ltd) | _Pending_ | Logan | ToS; DPA |
| `{{LUC_LEGAL_NAME}}` | Full registered name of Learners' University College | _Pending — Rejin to confirm full Dubai-registered name_ | Rejin | ToS; Enrolment Agreement |
| `{{LUC_REGISTERED_ADDRESS}}` | LUC registered address | _Pending_ | Rejin | Enrolment Agreement |
| `{{JURISDICTION_COURTS}}` | Courts with exclusive jurisdiction | e.g. "Mumbai" or "Bengaluru" | Logan + LUC legal | ToS; AUP; Refund |
| `{{GOVERNING_LAW}}` | Governing law | "Republic of India" | Logan + LUC legal | ToS; AUP; Refund; DPA |
| `{{DPO_NAME}}` | Data Protection Officer's name | _To be designated_ | LUC | Privacy; DSAR; DPA; Compliance docs |
| `{{DPO_EMAIL}}` | DPO's email | _Pending_ | LUC | Privacy; DSAR; DPA; SECURITY.md (security email fallback) |
| `{{DPO_PHONE}}` | DPO's phone (optional) | _Pending_ | LUC | Privacy |
| `{{SUPPORT_EMAIL}}` | General support address | e.g. `support@indialearns.app` | Logan | All user-facing docs |
| `{{SECURITY_EMAIL}}` | Vulnerability reporting | e.g. `security@indialearns.app` | Logan | SECURITY.md |
| `{{WEBSITE_URL}}` | Public production URL | e.g. `https://app.indialearns.com` | Logan | All docs |
| `{{EFFECTIVE_DATE}}` | Date the document takes effect | YYYY-MM-DD on publication | Vidit on publish | All legal docs |
| `{{REFUND_TIER_TABLE}}` | Refund percentages by week of programme | Per LUC pricing decision | LUC | Refund Policy; Enrolment Agreement |

## Document-specific placeholders

Some documents use placeholders unique to their content. They are listed in each doc's "Placeholders" section. The list below is the consolidated view.

### terms-of-service.md
- `{{ORG_NAME}}`, `{{ORG_REGISTERED_ADDRESS}}`, `{{ORG_GSTIN}}`, `{{ORG_CIN}}`
- `{{LUC_LEGAL_NAME}}`, `{{LUC_REGISTERED_ADDRESS}}`
- `{{JURISDICTION_COURTS}}`, `{{GOVERNING_LAW}}`
- `{{SUPPORT_EMAIL}}`, `{{WEBSITE_URL}}`
- `{{EFFECTIVE_DATE}}`

### privacy-policy.md
- `{{ORG_NAME}}`, `{{ORG_REGISTERED_ADDRESS}}`
- `{{DPO_NAME}}`, `{{DPO_EMAIL}}`, `{{DPO_PHONE}}`
- `{{WEBSITE_URL}}`, `{{SUPPORT_EMAIL}}`
- `{{EFFECTIVE_DATE}}`

### cookie-policy.md
- `{{ORG_NAME}}`, `{{WEBSITE_URL}}`, `{{DPO_EMAIL}}`, `{{EFFECTIVE_DATE}}`

### acceptable-use-policy.md
- `{{ORG_NAME}}`, `{{SUPPORT_EMAIL}}`, `{{JURISDICTION_COURTS}}`, `{{EFFECTIVE_DATE}}`

### refund-policy.md
- `{{ORG_NAME}}`, `{{LUC_LEGAL_NAME}}`, `{{REFUND_TIER_TABLE}}`, `{{SUPPORT_EMAIL}}`, `{{EFFECTIVE_DATE}}`

### student-enrollment-agreement.md
- `{{LUC_LEGAL_NAME}}`, `{{LUC_REGISTERED_ADDRESS}}`
- `{{JURISDICTION_COURTS}}`, `{{GOVERNING_LAW}}`
- `{{REFUND_TIER_TABLE}}`
- `{{EFFECTIVE_DATE}}`

### dpa-template.md
- `{{ORG_NAME}}`, `{{ORG_REGISTERED_ADDRESS}}`
- `{{DPO_NAME}}`, `{{DPO_EMAIL}}`
- `{{GOVERNING_LAW}}`, `{{JURISDICTION_COURTS}}`
- `{{EFFECTIVE_DATE}}`

## Verification before publishing

After replacement, run all of:

```bash
# 1. No placeholders left
grep -rn "{{" docs/legal/ && echo "❌ placeholders remain" || echo "✅ no placeholders"

# 2. Legal counsel review obtained — ask Logan and LUC's legal team
# 3. Publication date set on every doc

# 4. Live site links to the policies — confirm /privacy, /terms, /refund routes return the docs
curl -sf "{{WEBSITE_URL}}/privacy" >/dev/null && echo "✅ live"
```

## Where these values get embedded

- **Receipts (PDF)** — `RECEIPT_ORG_NAME` / `RECEIPT_ORG_ADDRESS` / `RECEIPT_ORG_GSTIN` env vars in the Render secret group `il-app-secrets`. See [`api/src/services/receiptService.ts`](../../api/src/services/receiptService.ts) and [`render.yaml`](../../render.yaml).
- **Email "from"** — `EMAIL_FROM` env var. Default `India Learns <notifications@indialearns.app>` in [`render.yaml`](../../render.yaml); update to the resolved entity if the brand changes.
- **Public-facing legal pages** — once domain is live, these markdown docs are rendered (or rewritten in the marketing site) and linked from the app footer + invite-acceptance flow.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: until all placeholders are resolved, then quarterly._
