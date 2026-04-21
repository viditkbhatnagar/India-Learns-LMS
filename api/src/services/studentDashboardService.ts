import type { Types } from 'mongoose';
import type { StudentDashboardDto } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import { type HydratedUser } from '../models/index.js';
import {
  listEnrollmentsForStudent,
  toEnrollmentDto,
} from './enrollmentService.js';
import { buildOutstandingFees } from './studentFeesService.js';
import { getNextClassForStudent } from './timetableResolutionService.js';
import { toUserDto } from './userService.js';
import { countIssuedCertificatesForStudent } from './certificateService.js';
import { countUnreadForUser } from './notificationService.js';

export async function buildStudentDashboard(
  student: HydratedUser,
): Promise<StudentDashboardDto> {
  if (student.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students have a student dashboard.');
  }
  const studentId = student._id as unknown as Types.ObjectId;
  const [
    enrolments,
    nextClass,
    outstandingFees,
    certificates,
    unreadCount,
  ] = await Promise.all([
    listEnrollmentsForStudent(studentId),
    getNextClassForStudent(studentId),
    buildOutstandingFees(studentId),
    countIssuedCertificatesForStudent(studentId),
    countUnreadForUser(studentId),
  ]);
  return {
    student: toUserDto(student),
    enrolments: enrolments.map(toEnrollmentDto),
    nextClass: { stub: false, value: nextClass },
    outstandingFees,
    // M6 fills with open ticket count.
    openTickets: { stub: true, count: 0 },
    // M7 fills with unread feedback count.
    newFeedback: { stub: true, count: 0 },
    // M8 — certificates + unread notifications are real.
    certificates: {
      count: certificates.count,
      latestIssuedAt: certificates.latestIssuedAt
        ? certificates.latestIssuedAt.toISOString()
        : null,
    },
    unreadNotifications: { count: unreadCount },
  };
}
