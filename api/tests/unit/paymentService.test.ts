import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeAdmin,
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeFeeStructure,
  makeInstallment,
  makeInvoice,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import {
  recordPayment,
  reversePayment,
} from '../../src/services/paymentService.js';
import {
  FeeInstallment,
  Invoice,
  Receipt,
  CreditNote,
} from '../../src/models/index.js';
import { setTestNow, resetClock } from '../../src/services/clockService.js';

async function scaffoldFees() {
  const program = await makeProgram();
  const { user: faculty } = await makeFaculty();
  const course = await makeCourse({
    programId: program._id,
    state: 'published',
    facultyIds: [faculty._id],
  });
  const batch = await makeBatch({ programId: program._id });
  const { user: student } = await makeStudent();
  const enrolment = await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
  });
  const structure = await makeFeeStructure({ programId: program._id });
  const invoice = await makeInvoice({
    enrollmentId: enrolment._id,
    studentId: student._id,
    feeStructureId: structure._id,
    totalPaise: 3_000_000,
  });
  const i1 = await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: 1_000_000,
    dueDate: new Date('2026-07-15T00:00:00Z'),
  });
  const i2 = await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: 1_000_000,
    dueDate: new Date('2026-08-15T00:00:00Z'),
  });
  const i3 = await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: 1_000_000,
    dueDate: new Date('2026-09-15T00:00:00Z'),
  });
  const { user: admin } = await makeAdmin();
  return { program, student, enrolment, invoice, i1, i2, i3, admin };
}

describe('paymentService.recordPayment', () => {
  useMongo();
  useIntegrationSpies();

  it('auto-allocates oldest-first and marks installment paid', async () => {
    const { student, i1, admin } = await scaffoldFees();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
        reference: 'TXN-1',
      },
      { actorUserId: admin._id },
    );
    expect(result.payment.allocations).toHaveLength(1);
    expect(result.payment.allocations[0]!.installmentId.equals(i1._id)).toBe(true);
    const reloadedI1 = await FeeInstallment.findById(i1._id);
    expect(reloadedI1?.status).toBe('paid');
    const receipt = await Receipt.findOne({ paymentId: result.payment._id });
    expect(receipt?.code).toMatch(/^RCP-\d{4}-\d{6}$/);
  });

  it('splits a payment across multiple installments', async () => {
    const { student, i1, i2, admin } = await scaffoldFees();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 1_500_000,
        method: 'bank_transfer',
        reference: 'TXN-2',
      },
      { actorUserId: admin._id },
    );
    expect(result.payment.allocations).toHaveLength(2);
    const r1 = await FeeInstallment.findById(i1._id);
    const r2 = await FeeInstallment.findById(i2._id);
    expect(r1?.status).toBe('paid');
    expect(r2?.status).toBe('partial');
    expect(r2?.paidPaise).toBe(500_000);
  });

  it('creates a CreditNote on overpayment', async () => {
    const { student, admin } = await scaffoldFees();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 3_500_000, // ₹35k > ₹30k total
        method: 'upi',
      },
      { actorUserId: admin._id },
    );
    expect(result.creditNote).not.toBeNull();
    expect(result.creditNote!.amountPaise).toBe(500_000);
    const cn = await CreditNote.findById(result.creditNote!._id);
    expect(cn?.consumed).toBe(false);
  });

  it('honours explicit allocations', async () => {
    const { student, i2, admin } = await scaffoldFees();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 500_000,
        method: 'cash',
        allocations: [{ installmentId: String(i2._id), amountPaise: 500_000 }],
      },
      { actorUserId: admin._id },
    );
    expect(result.payment.allocations[0]!.installmentId.equals(i2._id)).toBe(true);
    const r2 = await FeeInstallment.findById(i2._id);
    expect(r2?.paidPaise).toBe(500_000);
  });

  it('rejects over-application (explicit > installment balance)', async () => {
    const { student, i1, admin } = await scaffoldFees();
    await expect(
      recordPayment(
        {
          studentId: String(student._id),
          amountPaise: 2_000_000,
          method: 'upi',
          allocations: [
            { installmentId: String(i1._id), amountPaise: 2_000_000 },
          ],
        },
        { actorUserId: admin._id },
      ),
    ).rejects.toMatchObject({ code: 'PAYMENT_OVERAPPLIED' });
  });

  it('settles the Invoice when balance clears to zero', async () => {
    const { student, invoice, admin } = await scaffoldFees();
    await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 3_000_000,
        method: 'upi',
      },
      { actorUserId: admin._id },
    );
    const reloaded = await Invoice.findById(invoice._id);
    expect(reloaded?.balancePaise).toBe(0);
    expect(reloaded?.status).toBe('settled');
  });
});

describe('paymentService.reversePayment', () => {
  useMongo();
  useIntegrationSpies();

  it('reverses a payment within 24h and debits installments', async () => {
    const { student, i1, admin } = await scaffoldFees();
    const recorded = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
      },
      { actorUserId: admin._id },
    );
    const reversed = await reversePayment(
      String(recorded.payment._id),
      'Duplicate payment',
      { actorUserId: admin._id },
    );
    expect(reversed.creditNote.amountPaise).toBe(1_000_000);
    const r1 = await FeeInstallment.findById(i1._id);
    expect(r1?.paidPaise).toBe(0);
    expect(r1?.status).toBe('pending');
  });

  it('refuses reversal past the 24h window', async () => {
    const { student, admin } = await scaffoldFees();
    const recorded = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 500_000,
        method: 'upi',
        receivedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      },
      { actorUserId: admin._id },
    );
    setTestNow(new Date('2026-01-05T00:00:00Z'));
    try {
      await expect(
        reversePayment(String(recorded.payment._id), 'late', {
          actorUserId: admin._id,
        }),
      ).rejects.toMatchObject({ code: 'REVERSAL_WINDOW_EXPIRED' });
    } finally {
      resetClock();
    }
  });
});
