import type { FeeDueRule } from 'india-learns-shared-types';
import { addDays, addMonths } from 'date-fns';

export interface DueRuleContext {
  enrolmentAnchor: Date;
  batchEndDate: Date;
  // Examination components: scheduled date if known, else fall back to
  // batch.endDate - 14d. Kept optional so the resolver stays pure.
  examScheduledAt?: Date | null;
}

/**
 * Compute the due date for the Nth installment of a fee component.
 * `installmentIndex` is 0-based; `one_time` components use index 0.
 *
 * TRD §4.6 defines the enum; the spec is silent on the exact offset math so
 * M5 picks a minimal, predictable interpretation:
 *   - on_enrolment     → anchor + (30 * i) days
 *   - first_of_month   → 1st of the month i months after anchor
 *   - exam_scheduled   → examScheduledAt (or batchEndDate - 14d)
 *   - month_before_end → batchEndDate - 30 days
 *   - manual           → anchor (admin sets the true dueDate later)
 */
export function resolveInstallmentDueDate(
  rule: FeeDueRule,
  installmentIndex: number,
  ctx: DueRuleContext,
): Date {
  const anchor = new Date(ctx.enrolmentAnchor.getTime());
  switch (rule) {
    case 'on_enrolment':
      return addDays(anchor, 30 * installmentIndex);
    case 'first_of_month': {
      const target = addMonths(anchor, installmentIndex);
      return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
    }
    case 'exam_scheduled':
      if (ctx.examScheduledAt) {
        return new Date(ctx.examScheduledAt.getTime());
      }
      return addDays(ctx.batchEndDate, -14);
    case 'month_before_end':
      return addDays(ctx.batchEndDate, -30);
    case 'manual':
      return anchor;
    default: {
      // Exhaustiveness guard; `never` will error at compile time if a new
      // FeeDueRule enum value is added without a case.
      const exhaustive: never = rule;
      return exhaustive;
    }
  }
}
