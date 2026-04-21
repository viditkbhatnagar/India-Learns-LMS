import type { Types } from 'mongoose';
import type { StudentDashboardDto } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import { type HydratedUser } from '../models/index.js';
import {
  listEnrollmentsForStudent,
  toEnrollmentDto,
} from './enrollmentService.js';
import { toUserDto } from './userService.js';

export async function buildStudentDashboard(
  student: HydratedUser,
): Promise<StudentDashboardDto> {
  if (student.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students have a student dashboard.');
  }
  const enrolments = await listEnrollmentsForStudent(
    student._id as unknown as Types.ObjectId,
  );
  return {
    student: toUserDto(student),
    enrolments: enrolments.map(toEnrollmentDto),
    // M4 fills this with actual next-class data from Timetable.
    nextClass: { stub: true, value: null },
    // M5 fills with outstanding installments.
    outstandingFees: { stub: true, totalPaise: 0 },
    // M6 fills with open ticket count.
    openTickets: { stub: true, count: 0 },
    // M7 fills with unread feedback count.
    newFeedback: { stub: true, count: 0 },
  };
}
