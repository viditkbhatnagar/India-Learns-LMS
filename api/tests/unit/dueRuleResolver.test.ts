import { describe, expect, it } from 'vitest';
import { resolveInstallmentDueDate } from '../../src/services/dueRuleResolver.js';

const anchor = new Date('2026-07-01T00:00:00Z');
const batchEnd = new Date('2026-12-31T00:00:00Z');

describe('resolveInstallmentDueDate', () => {
  it('on_enrolment staggers 30 days per installment', () => {
    const d0 = resolveInstallmentDueDate('on_enrolment', 0, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    const d1 = resolveInstallmentDueDate('on_enrolment', 1, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    const d2 = resolveInstallmentDueDate('on_enrolment', 2, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    expect(d0.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(d1.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(d2.toISOString()).toBe('2026-08-30T00:00:00.000Z');
  });

  it('first_of_month returns 1st of the Nth month after anchor', () => {
    const d = resolveInstallmentDueDate('first_of_month', 2, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('exam_scheduled uses examScheduledAt when provided', () => {
    const exam = new Date('2026-11-15T00:00:00Z');
    const d = resolveInstallmentDueDate('exam_scheduled', 0, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
      examScheduledAt: exam,
    });
    expect(d.toISOString()).toBe(exam.toISOString());
  });

  it('exam_scheduled falls back to batchEndDate - 14d', () => {
    const d = resolveInstallmentDueDate('exam_scheduled', 0, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    expect(d.toISOString()).toBe('2026-12-17T00:00:00.000Z');
  });

  it('month_before_end returns batchEnd - 30d', () => {
    const d = resolveInstallmentDueDate('month_before_end', 0, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    expect(d.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('manual returns enrolmentAnchor', () => {
    const d = resolveInstallmentDueDate('manual', 3, {
      enrolmentAnchor: anchor,
      batchEndDate: batchEnd,
    });
    expect(d.toISOString()).toBe(anchor.toISOString());
  });
});
