# ADR 0006 — Money as integer paise

**Status:** Accepted
**Date:** 2026-02-15
**Author:** Vidit Bhatnagar

## Context

The platform records and displays money: fee structures, instalments, invoices, payments, receipts, refunds. We had to choose a representation that:

- Avoids floating-point arithmetic errors.
- Is precise enough for ₹0.01.
- Round-trips cleanly across JSON, MongoDB, and the React app.

## Decision

**Store every money field as integer paise (1 INR = 100 paise) in fields suffixed `Paise`.** Convert to display in the UI via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

Examples (from real models):

- `FeeStructure.totalPaise: 250000` → ₹2,500.00
- `Invoice.totalPaise: 750000` → ₹7,500.00
- `Payment.amountPaise: 250000`

## Rationale

- **No floats.** JavaScript numbers are IEEE-754 doubles; arithmetic on `2500.30 + 1234.50` lands at `3734.7999999999997`. Integer paise sidesteps the entire problem.
- **MongoDB integer storage** — Mongoose's `Number` type maps to BSON int32/int64; integers up to 2^53 are exact, which is far beyond any conceivable single-row money value.
- **Self-documenting.** A field named `totalPaise` cannot be confused for rupees. Reviewers spot mistakes by name.
- **Conversion to display happens at one place** — see [`web/src/lib/format.ts`](../../../web/src/lib/format.ts) — so locale changes are a single edit.

## Consequences

**Good:**

- All sums, percentages (refunds), and split-allocations are exact integer arithmetic.
- Reconciliation against bank statements is precise.
- Receipt PDFs render exact totals.

**Trade-offs:**

- API consumers must know to divide by 100 for display. We document this in [api-reference.md](../api-reference.md) "Conventions" and in field names.
- Users who write tests must remember to use paise in expected values.

## Alternatives considered

- **Decimal libraries (decimal.js, big.js).** Higher overhead and a non-trivial dependency for the value gained.
- **MongoDB `Decimal128` type.** Works but introduces driver-specific considerations and doesn't simplify front-end display.
- **Rupees as floats.** Considered and rejected — the floating-point arithmetic edge cases are too easy to ship.

## References

- [`api/src/models/feeStructure.ts`](../../../api/src/models/feeStructure.ts)
- [`api/src/models/payment.ts`](../../../api/src/models/payment.ts)
- [`api/src/models/invoice.ts`](../../../api/src/models/invoice.ts)
- [`web/src/lib/format.ts`](../../../web/src/lib/format.ts)
- [CLAUDE.md §5](../../../CLAUDE.md) — "Money" convention
