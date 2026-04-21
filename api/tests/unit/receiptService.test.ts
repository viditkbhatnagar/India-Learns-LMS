import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeAdmin,
  makeInstallment,
  makeInvoice,
  makeFeeStructure,
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { recordPayment } from '../../src/services/paymentService.js';
import {
  financialYearFor,
  generateReceiptPdf,
} from '../../src/services/receiptService.js';
import { Receipt } from '../../src/models/index.js';
import { resetClock } from '../../src/services/clockService.js';

afterEach(() => resetClock());

describe('financialYearFor', () => {
  it('returns prior year before April', () => {
    expect(financialYearFor(new Date('2026-03-31T12:00:00Z'))).toBe(2025);
  });
  it('returns current year from April onward', () => {
    expect(financialYearFor(new Date('2026-04-01T12:00:00Z'))).toBe(2026);
    expect(financialYearFor(new Date('2026-12-31T12:00:00Z'))).toBe(2026);
  });
});

describe('receiptService.generateReceiptPdf', () => {
  useMongo();
  const spies = useIntegrationSpies();

  async function seed() {
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
      totalPaise: 1_000_000,
    });
    const installment = await makeInstallment({
      invoiceId: invoice._id,
      studentId: student._id,
      amountPaise: 1_000_000,
    });
    const { user: admin } = await makeAdmin();
    return { student, installment, admin };
  }

  it('persists a Receipt with a Cloudinary-like URL and PDF bytes', async () => {
    const { student, admin } = await seed();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
      },
      { actorUserId: admin._id },
    );
    const receipt = await Receipt.findOne({ paymentId: result.payment._id });
    expect(receipt).toBeTruthy();
    expect(receipt!.code).toMatch(/^RCP-\d{4}-\d{6}$/);
    expect(spies.storage.uploads).toHaveLength(1);
    const upload = spies.storage.uploads[0]!;
    expect(upload.folder).toBe('receipts');
    expect(upload.contentType).toBe('application/pdf');
    expect(upload.bytes!.byteLength).toBeGreaterThan(200);
  });

  it('renders a PDF with no undefined fields', async () => {
    const { student, admin } = await seed();
    const result = await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'bank_transfer',
        reference: 'HDFC-123',
      },
      { actorUserId: admin._id },
    );
    const bytes = await generateReceiptPdf(result.payment, {
      receiptCode: 'RCP-TEST-000001',
      issuedByUserId: admin._id,
    });
    const text = Buffer.from(bytes).toString('binary');
    // PDF magic number.
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).not.toContain('undefined');
  });
});
