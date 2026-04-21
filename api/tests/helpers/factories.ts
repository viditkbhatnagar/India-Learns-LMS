import type { Types } from 'mongoose';
import type {
  FeeComponentCadence,
  FeeComponentKind,
  FeeDueRule,
  OverrideAction,
  PaymentMethod,
  Role,
  TicketCategory,
  TicketCommentVisibility,
  TicketPriority,
  TicketState,
} from 'india-learns-shared-types';
import {
  Batch,
  Course,
  CreditNote,
  Enrollment,
  FeeInstallment,
  FeeStructure,
  Holiday,
  Invoice,
  ModuleModel,
  Notification,
  Payment,
  Program,
  Receipt,
  Ticket,
  TicketComment,
  TimetableEntry,
  TimetableOverride,
  User,
  type BatchDoc,
  type CourseDoc,
  type CreditNoteDoc,
  type EnrollmentDoc,
  type FeeComponentDoc,
  type FeeInstallmentDoc,
  type FeeStructureDoc,
  type HolidayDoc,
  type InvoiceDoc,
  type ModuleDoc,
  type NotificationDoc,
  type PaymentDoc,
  type ProgramDoc,
  type ReceiptDoc,
  type TicketCommentDoc,
  type TicketDoc,
  type TimetableEntryDoc,
  type TimetableOverrideDoc,
  type UserDoc,
} from '../../src/models/index.js';
import { hashPassword } from '../../src/services/passwordService.js';
import { utcDateForIstDay } from '../../src/services/timetableTz.js';
import {
  nextInvoiceCode,
  nextReceiptCode,
  nextTicketCode,
} from '../../src/services/counterService.js';

export interface MakeUserInput {
  role?: Role;
  email?: string;
  name?: string;
  phoneE164?: string;
  password?: string;
  status?: UserDoc['status'];
  code?: string | null;
  programId?: Types.ObjectId | null;
  batchId?: Types.ObjectId | null;
}

let counter = 0;

export async function makeUser(input: MakeUserInput = {}): Promise<UserDoc> {
  counter += 1;
  const role = input.role ?? 'student';
  const email = input.email ?? `u${counter}-${Date.now()}@test.local`;
  const doc = await User.create({
    role,
    code: input.code ?? null,
    name: input.name ?? `User ${counter}`,
    email,
    phoneE164: input.phoneE164 ?? `+9199900${String(counter).padStart(5, '0')}`,
    status: input.status ?? 'active',
    passwordHash: input.password ? await hashPassword(input.password) : null,
    passwordUpdatedAt: input.password ? new Date() : null,
    programId: input.programId ?? null,
    batchId: input.batchId ?? null,
  });
  return doc;
}

export async function makeAdmin(
  password = 'Admin#12345',
): Promise<{ user: UserDoc; password: string }> {
  const user = await makeUser({
    role: 'admin',
    email: `admin-${Date.now()}-${Math.random()}@test.local`,
    password,
    status: 'active',
    name: 'Admin User',
  });
  return { user, password };
}

export async function makeStudent(
  password = 'Student#12345',
): Promise<{ user: UserDoc; password: string }> {
  const user = await makeUser({
    role: 'student',
    email: `stu-${Date.now()}-${Math.random()}@test.local`,
    password,
    status: 'active',
    name: 'Student User',
  });
  return { user, password };
}

export async function makeFaculty(
  password = 'Faculty#12345',
): Promise<{ user: UserDoc; password: string }> {
  const user = await makeUser({
    role: 'faculty',
    email: `fac-${Date.now()}-${Math.random()}@test.local`,
    password,
    status: 'active',
    name: 'Faculty User',
  });
  return { user, password };
}

export interface MakeProgramInput {
  slug?: string;
  name?: string;
  description?: string;
  totalHours?: number;
  isActive?: boolean;
}

export async function makeProgram(input: MakeProgramInput = {}): Promise<ProgramDoc> {
  counter += 1;
  const slug = input.slug ?? `program-${counter}-${Date.now()}`;
  return Program.create({
    slug,
    name: input.name ?? `Program ${counter}`,
    description: input.description ?? '',
    totalHours: input.totalHours ?? 300,
    isActive: input.isActive ?? true,
  });
}

export interface MakeCourseInput {
  programId: Types.ObjectId;
  slug?: string;
  name?: string;
  state?: CourseDoc['state'];
  facultyIds?: Types.ObjectId[];
  sequential?: boolean;
}

export async function makeCourse(input: MakeCourseInput): Promise<CourseDoc> {
  counter += 1;
  const slug = input.slug ?? `course-${counter}-${Date.now()}`;
  return Course.create({
    programId: input.programId,
    slug,
    name: input.name ?? `Course ${counter}`,
    summary: '',
    state: input.state ?? 'sandbox',
    publishedAt: input.state === 'published' ? new Date() : null,
    publishedVersion: input.state === 'published' ? 1 : 0,
    sequential: input.sequential ?? false,
    facultyIds: input.facultyIds ?? [],
  });
}

export interface MakeModuleInput {
  courseId: Types.ObjectId;
  order?: number;
  title?: string;
  content?: ModuleDoc['content'];
}

export async function makeModule(input: MakeModuleInput): Promise<ModuleDoc> {
  counter += 1;
  return ModuleModel.create({
    courseId: input.courseId,
    order: input.order ?? 0,
    title: input.title ?? `Module ${counter}`,
    content: (input.content ?? []) as unknown as ModuleDoc['content'],
  });
}

export interface MakeBatchInput {
  programId: Types.ObjectId;
  name?: string;
  startDate?: Date;
  endDate?: Date;
  capacity?: number;
  status?: BatchDoc['status'];
  coordinators?: Types.ObjectId[];
}

export async function makeBatch(input: MakeBatchInput): Promise<BatchDoc> {
  counter += 1;
  const start = input.startDate ?? new Date('2026-07-01T00:00:00Z');
  const end = input.endDate ?? new Date('2026-12-31T00:00:00Z');
  return Batch.create({
    programId: input.programId,
    name: input.name ?? `Batch ${counter}`,
    startDate: start,
    endDate: end,
    capacity: input.capacity ?? 30,
    status: input.status ?? 'planned',
    coordinators: input.coordinators ?? [],
  });
}

export interface MakeEnrollmentInput {
  studentId: Types.ObjectId;
  batchId: Types.ObjectId;
  courseId: Types.ObjectId;
  programId: Types.ObjectId;
  validFrom?: Date;
  validTo?: Date;
  status?: EnrollmentDoc['status'];
  accessState?: EnrollmentDoc['accessState'];
}

export async function makeEnrollment(
  input: MakeEnrollmentInput,
): Promise<EnrollmentDoc> {
  return Enrollment.create({
    studentId: input.studentId,
    batchId: input.batchId,
    courseId: input.courseId,
    programId: input.programId,
    validFrom: input.validFrom ?? new Date('2026-07-01T00:00:00Z'),
    validTo: input.validTo ?? new Date('2027-07-01T00:00:00Z'),
    status: input.status ?? 'active',
    accessState: input.accessState ?? 'active',
  });
}

export interface MakeTimetableEntryInput {
  batchId: Types.ObjectId;
  courseId: Types.ObjectId;
  facultyId: Types.ObjectId;
  dayOfWeek: number;
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  room?: string;
  notes?: string;
}

export async function makeTimetableEntry(
  input: MakeTimetableEntryInput,
): Promise<TimetableEntryDoc> {
  return TimetableEntry.create({
    batchId: input.batchId,
    courseId: input.courseId,
    facultyId: input.facultyId,
    dayOfWeek: input.dayOfWeek,
    startTimeMinutes: input.startTimeMinutes ?? 1080,
    endTimeMinutes: input.endTimeMinutes ?? 1200,
    room: input.room ?? 'Room 1',
    notes: input.notes ?? '',
  });
}

export interface MakeTimetableOverrideInput {
  batchId: Types.ObjectId;
  entryId?: Types.ObjectId | null;
  istDate: string;
  action: OverrideAction;
  newCourseId?: Types.ObjectId | null;
  newFacultyId?: Types.ObjectId | null;
  newStartMinutes?: number | null;
  newEndMinutes?: number | null;
  newRoom?: string | null;
  reason?: string;
}

export async function makeTimetableOverride(
  input: MakeTimetableOverrideInput,
): Promise<TimetableOverrideDoc> {
  return TimetableOverride.create({
    batchId: input.batchId,
    entryId: input.entryId ?? null,
    date: utcDateForIstDay(input.istDate),
    action: input.action,
    newCourseId: input.newCourseId ?? null,
    newFacultyId: input.newFacultyId ?? null,
    newStartMinutes: input.newStartMinutes ?? null,
    newEndMinutes: input.newEndMinutes ?? null,
    newRoom: input.newRoom ?? null,
    reason: input.reason ?? '',
  });
}

export interface MakeHolidayInput {
  istDate: string;
  name?: string;
  kind?: HolidayDoc['kind'];
}

export async function makeHoliday(input: MakeHolidayInput): Promise<HolidayDoc> {
  return Holiday.create({
    date: utcDateForIstDay(input.istDate),
    name: input.name ?? 'Test Holiday',
    kind: input.kind ?? 'public',
  });
}

export interface MakeNotificationInput {
  userId: Types.ObjectId;
  type?: NotificationDoc['type'];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function makeNotification(
  input: MakeNotificationInput,
): Promise<NotificationDoc> {
  return Notification.create({
    userId: input.userId,
    type: input.type ?? 'timetable.change',
    title: input.title ?? 'Test',
    body: input.body ?? 'Test body',
    data: input.data ?? {},
    channels: ['inapp'],
  });
}

export interface MakeFeeStructureInput {
  programId: Types.ObjectId;
  name?: string;
  components?: Array<{
    kind: FeeComponentKind;
    label: string;
    amountPaise: number;
    cadence: FeeComponentCadence;
    monthlyCount?: number | null;
    dueRule: FeeDueRule;
    weights?: number[] | null;
  }>;
}

export async function makeFeeStructure(
  input: MakeFeeStructureInput,
): Promise<FeeStructureDoc> {
  counter += 1;
  const components: FeeComponentDoc[] = (
    input.components ?? [
      {
        kind: 'registration',
        label: 'Registration',
        amountPaise: 1_000_000,
        cadence: 'one_time',
        monthlyCount: null,
        dueRule: 'on_enrolment',
        weights: null,
      },
      {
        kind: 'tuition',
        label: 'Tuition',
        amountPaise: 6_000_000,
        cadence: 'monthly_x',
        monthlyCount: 3,
        dueRule: 'on_enrolment',
        weights: null,
      },
    ]
  ).map((c) => ({
    kind: c.kind,
    label: c.label,
    amountPaise: c.amountPaise,
    cadence: c.cadence,
    monthlyCount: c.monthlyCount ?? null,
    dueRule: c.dueRule,
    weights: c.weights ?? null,
  }));
  return FeeStructure.create({
    programId: input.programId,
    name: input.name ?? `Structure ${counter}`,
    components,
    paymentTerms: '',
  });
}

export interface MakeInvoiceInput {
  enrollmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  feeStructureId: Types.ObjectId;
  totalPaise?: number;
  componentKind?: FeeComponentKind;
  componentLabel?: string;
  code?: string;
}

export async function makeInvoice(input: MakeInvoiceInput): Promise<InvoiceDoc> {
  counter += 1;
  const code = input.code ?? (await nextInvoiceCode(new Date().getUTCFullYear()));
  const total = input.totalPaise ?? 1_000_000;
  return Invoice.create({
    code,
    enrollmentId: input.enrollmentId,
    studentId: input.studentId,
    feeStructureId: input.feeStructureId,
    componentKind: input.componentKind ?? 'tuition',
    componentLabel: input.componentLabel ?? `Invoice ${counter}`,
    totalPaise: total,
    paidPaise: 0,
    balancePaise: total,
    status: 'open',
  });
}

export interface MakeInstallmentInput {
  invoiceId: Types.ObjectId;
  studentId: Types.ObjectId;
  amountPaise?: number;
  dueDate?: Date;
  label?: string;
  status?: FeeInstallmentDoc['status'];
  paidPaise?: number;
  remindersSent?: FeeInstallmentDoc['remindersSent'];
}

export async function makeInstallment(
  input: MakeInstallmentInput,
): Promise<FeeInstallmentDoc> {
  counter += 1;
  return FeeInstallment.create({
    invoiceId: input.invoiceId,
    studentId: input.studentId,
    label: input.label ?? `Installment ${counter}`,
    amountPaise: input.amountPaise ?? 1_000_000,
    paidPaise: input.paidPaise ?? 0,
    dueDate: input.dueDate ?? new Date(Date.now() + 14 * 86_400_000),
    status: input.status ?? 'pending',
    remindersSent: input.remindersSent ?? [],
  });
}

export interface MakePaymentInput {
  studentId: Types.ObjectId;
  receivedByUserId: Types.ObjectId;
  amountPaise?: number;
  method?: PaymentMethod;
  receivedAt?: Date;
  allocations?: Array<{ installmentId: Types.ObjectId; amountPaise: number }>;
}

export async function makePayment(input: MakePaymentInput): Promise<PaymentDoc> {
  return Payment.create({
    studentId: input.studentId,
    receivedAt: input.receivedAt ?? new Date(),
    amountPaise: input.amountPaise ?? 1_000_000,
    method: input.method ?? 'upi',
    reference: 'TEST-REF',
    allocations: input.allocations ?? [],
    receivedByUserId: input.receivedByUserId,
    notes: '',
    reversed: false,
    reversedAt: null,
    creditNoteId: null,
  });
}

export interface MakeReceiptInput {
  paymentId: Types.ObjectId;
  studentId: Types.ObjectId;
  issuedByUserId: Types.ObjectId;
  code?: string;
  issuedAt?: Date;
}

export async function makeReceipt(input: MakeReceiptInput): Promise<ReceiptDoc> {
  const year = (input.issuedAt ?? new Date()).getUTCFullYear();
  counter += 1;
  const doc = await Receipt.create({
    code: input.code ?? (await nextReceiptCode(year)),
    paymentId: input.paymentId,
    studentId: input.studentId,
    pdfUrl: 'https://stub.local/receipts/test.pdf',
    pdfKey: `stub:receipts:test-${counter}`,
    issuedAt: input.issuedAt ?? new Date(),
    issuedByUserId: input.issuedByUserId,
  });
  return doc;
}

export interface MakeCreditNoteInput {
  studentId: Types.ObjectId;
  paymentId?: Types.ObjectId | null;
  amountPaise?: number;
  code?: string;
  issuedByUserId?: Types.ObjectId | null;
}

export async function makeCreditNote(
  input: MakeCreditNoteInput,
): Promise<CreditNoteDoc> {
  const amount = input.amountPaise ?? 100_000;
  counter += 1;
  return CreditNote.create({
    code: input.code ?? `CN-TEST-${counter}`,
    paymentId: input.paymentId ?? null,
    studentId: input.studentId,
    amountPaise: amount,
    balancePaise: amount,
    reason: 'Test credit note',
    consumed: false,
    issuedAt: new Date(),
    issuedByUserId: input.issuedByUserId ?? null,
  });
}

export interface MakeOverdueStudentInput {
  programId: Types.ObjectId;
  daysOverdue: number;
  amountPaise?: number;
}

export async function makeOverdueStudent(
  input: MakeOverdueStudentInput,
): Promise<{
  student: UserDoc;
  program: ProgramDoc;
  batch: BatchDoc;
  course: CourseDoc;
  enrolment: EnrollmentDoc;
  invoice: InvoiceDoc;
  installment: FeeInstallmentDoc;
}> {
  const program = await Program.findById(input.programId);
  if (!program) throw new Error('makeOverdueStudent: program missing');
  const faculty = await makeUser({ role: 'faculty' });
  const course = await makeCourse({
    programId: program._id,
    state: 'published',
    facultyIds: [faculty._id],
  });
  const batch = await makeBatch({ programId: program._id, status: 'active' });
  const student = await makeUser({ role: 'student', status: 'active' });
  const enrolment = await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
    validFrom: new Date(Date.now() - 365 * 86_400_000),
    validTo: new Date(Date.now() + 365 * 86_400_000),
  });
  const structure = await makeFeeStructure({ programId: program._id });
  const dueDate = new Date(Date.now() - input.daysOverdue * 86_400_000);
  const invoice = await makeInvoice({
    enrollmentId: enrolment._id,
    studentId: student._id,
    feeStructureId: structure._id,
    totalPaise: input.amountPaise ?? 1_000_000,
  });
  const installment = await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: input.amountPaise ?? 1_000_000,
    dueDate,
    status: input.daysOverdue > 0 ? 'overdue' : 'pending',
  });
  return { student, program, batch, course, enrolment, invoice, installment };
}

export interface MakeTicketInput {
  studentId: Types.ObjectId;
  category?: TicketCategory;
  priority?: TicketPriority;
  subject?: string;
  description?: string;
  state?: TicketState;
  assigneeUserId?: Types.ObjectId | null;
  linkedCourseId?: Types.ObjectId | null;
  linkedInvoiceId?: Types.ObjectId | null;
  slaAckDeadline?: Date;
  slaResolveDeadline?: Date;
  slaAckBreached?: boolean;
  slaResolveBreached?: boolean;
  firstAckAt?: Date | null;
  resolvedAt?: Date | null;
  resolvedByUserId?: Types.ObjectId | null;
  resolutionNote?: string;
  closedAt?: Date | null;
  reopenedAt?: Date | null;
  reopenedFromId?: Types.ObjectId | null;
  parentTicketId?: Types.ObjectId | null;
  code?: string;
}

export async function makeTicket(input: MakeTicketInput): Promise<TicketDoc> {
  counter += 1;
  const now = new Date();
  const year = now.getUTCFullYear();
  const category = input.category ?? 'academic';
  const code = input.code ?? (await nextTicketCode(category, year));
  return Ticket.create({
    code,
    category,
    priority: input.priority ?? 'medium',
    studentId: input.studentId,
    linkedCourseId: input.linkedCourseId ?? null,
    linkedInvoiceId: input.linkedInvoiceId ?? null,
    subject: input.subject ?? `Subject ${counter}`,
    description: input.description ?? `Body ${counter}`,
    state: input.state ?? 'open',
    assigneeUserId: input.assigneeUserId ?? null,
    assignedAt: input.assigneeUserId ? now : null,
    firstAckAt: input.firstAckAt ?? null,
    resolvedAt: input.resolvedAt ?? null,
    resolvedByUserId: input.resolvedByUserId ?? null,
    resolutionNote: input.resolutionNote ?? '',
    closedAt: input.closedAt ?? null,
    reopenedAt: input.reopenedAt ?? null,
    reopenedFromId: input.reopenedFromId ?? null,
    parentTicketId: input.parentTicketId ?? null,
    slaAckDeadline:
      input.slaAckDeadline ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
    slaResolveDeadline:
      input.slaResolveDeadline ?? new Date(now.getTime() + 5 * 86_400_000),
    slaAckBreached: input.slaAckBreached ?? false,
    slaResolveBreached: input.slaResolveBreached ?? false,
  });
}

export interface MakeTicketCommentInput {
  ticketId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  body?: string;
  visibility?: TicketCommentVisibility;
}

export async function makeTicketComment(
  input: MakeTicketCommentInput,
): Promise<TicketCommentDoc> {
  counter += 1;
  return TicketComment.create({
    ticketId: input.ticketId,
    authorUserId: input.authorUserId,
    body: input.body ?? `Comment ${counter}`,
    visibility: input.visibility ?? 'public',
  });
}

