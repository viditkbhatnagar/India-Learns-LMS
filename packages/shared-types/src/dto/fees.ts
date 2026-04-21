import type {
  EnrollmentAccessState,
  FeeComponentCadence,
  FeeComponentKind,
  FeeDueRule,
  FeeReminderTemplate,
  InstallmentStatus,
  InvoiceStatus,
  PaymentMethod,
} from '../enums.js';

export interface FeeStructureComponentDto {
  kind: FeeComponentKind;
  label: string;
  amountPaise: number;
  cadence: FeeComponentCadence;
  monthlyCount: number | null;
  dueRule: FeeDueRule;
  weights: number[] | null;
}

export interface FeeStructureDto {
  id: string;
  programId: string;
  name: string;
  components: FeeStructureComponentDto[];
  paymentTerms: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructureInput {
  programId: string;
  name: string;
  components: FeeStructureComponentDto[];
  paymentTerms?: string;
}

export interface UpdateFeeStructureInput {
  name?: string;
  components?: FeeStructureComponentDto[];
  paymentTerms?: string;
}

export interface InvoiceDto {
  id: string;
  code: string;
  enrollmentId: string;
  studentId: string;
  feeStructureId: string;
  componentKind: FeeComponentKind;
  componentLabel: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeeInstallmentDto {
  id: string;
  invoiceId: string;
  studentId: string;
  label: string;
  amountPaise: number;
  paidPaise: number;
  balancePaise: number;
  dueDate: string;
  status: InstallmentStatus;
  remindersSent: Array<{ template: FeeReminderTemplate; at: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocationDto {
  installmentId: string;
  amountPaise: number;
}

export interface PaymentDto {
  id: string;
  studentId: string;
  receivedAt: string;
  amountPaise: number;
  method: PaymentMethod;
  reference: string;
  allocations: PaymentAllocationDto[];
  receivedByUserId: string;
  notes: string;
  reversed: boolean;
  reversedAt: string | null;
  creditNoteId: string | null;
  createdAt: string;
}

export interface RecordPaymentInput {
  studentId: string;
  amountPaise: number;
  method: PaymentMethod;
  reference?: string;
  receivedAt?: string;
  allocations?: PaymentAllocationDto[];
  notes?: string;
}

export interface ReceiptDto {
  id: string;
  code: string;
  paymentId: string;
  studentId: string;
  pdfUrl: string;
  pdfKey: string;
  issuedAt: string;
  issuedByUserId: string;
}

export interface CreditNoteDto {
  id: string;
  code: string;
  paymentId: string | null;
  studentId: string;
  amountPaise: number;
  balancePaise: number;
  reason: string;
  consumed: boolean;
  issuedAt: string;
}

export interface StudentFeesDto {
  studentId: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  nextDueDate: string | null;
  nextDueAmountPaise: number | null;
  invoices: InvoiceDto[];
  installments: FeeInstallmentDto[];
  receipts: ReceiptDto[];
  creditNotes: CreditNoteDto[];
  accessState: EnrollmentAccessState;
  suspensionOverrideUntil: string | null;
}

export interface OutstandingFeesDto {
  stub: false;
  totalPaise: number;
  invoiceCount: number;
  nextDueDate: string | null;
  nextDueAmountPaise: number | null;
}

export interface FeeReminderJobResult {
  processed: number;
  notificationsEnqueued: number;
  skipped: number;
  errors: Array<{ installmentId: string; message: string }>;
}

export interface AutoSuspendJobResult {
  evaluated: number;
  suspended: number;
  lifted: number;
  warned1: number;
  warned2: number;
  errors: Array<{ studentId: string; message: string }>;
}

export interface ApplyOverrideInput {
  until: string;
  reason: string;
}
