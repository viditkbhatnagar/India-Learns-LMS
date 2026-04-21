import type { HolidayKind, OverrideAction } from '../enums.js';

export interface TimetableEntryDto {
  id: string;
  batchId: string;
  courseId: string;
  facultyId: string;
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  room: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimetableEntryInput {
  courseId: string;
  facultyId: string;
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  room?: string;
  notes?: string;
}

export interface UpdateTimetableEntryInput {
  courseId?: string;
  facultyId?: string;
  dayOfWeek?: number;
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  room?: string;
  notes?: string;
}

export interface TimetableOverrideDto {
  id: string;
  batchId: string;
  entryId: string | null;
  date: string;
  action: OverrideAction;
  newCourseId: string | null;
  newFacultyId: string | null;
  newStartMinutes: number | null;
  newEndMinutes: number | null;
  newRoom: string | null;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimetableOverrideInput {
  batchId: string;
  entryId?: string | null;
  date: string;
  action: OverrideAction;
  newCourseId?: string | null;
  newFacultyId?: string | null;
  newStartMinutes?: number | null;
  newEndMinutes?: number | null;
  newRoom?: string | null;
  reason?: string;
}

export interface UpdateTimetableOverrideInput {
  action?: OverrideAction;
  newCourseId?: string | null;
  newFacultyId?: string | null;
  newStartMinutes?: number | null;
  newEndMinutes?: number | null;
  newRoom?: string | null;
  reason?: string;
}

export interface HolidayDto {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayInput {
  date: string;
  name: string;
  kind?: HolidayKind;
}

export interface TimetableOccurrenceDto {
  entryId: string | null;
  overrideId: string | null;
  batchId: string;
  courseId: string;
  courseName: string;
  facultyId: string;
  facultyName: string;
  date: string;
  startAt: string;
  endAt: string;
  room: string;
  notes: string;
  isOverride: boolean;
  isAdded: boolean;
}
