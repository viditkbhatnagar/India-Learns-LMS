import type { Types } from 'mongoose';
import type { OverrideAction, Role } from 'india-learns-shared-types';
import {
  Batch,
  Course,
  Enrollment,
  Holiday,
  ModuleModel,
  Notification,
  Program,
  TimetableEntry,
  TimetableOverride,
  User,
  type BatchDoc,
  type CourseDoc,
  type EnrollmentDoc,
  type HolidayDoc,
  type ModuleDoc,
  type NotificationDoc,
  type ProgramDoc,
  type TimetableEntryDoc,
  type TimetableOverrideDoc,
  type UserDoc,
} from '../../src/models/index.js';
import { hashPassword } from '../../src/services/passwordService.js';
import { utcDateForIstDay } from '../../src/services/timetableTz.js';

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

