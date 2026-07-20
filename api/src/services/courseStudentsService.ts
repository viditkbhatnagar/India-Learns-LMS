import { Types } from 'mongoose';
import type { CourseStudentDto } from 'india-learns-shared-types';
import { Enrollment, User } from '../models/index.js';

/**
 * Roster of students actively enrolled in a course, for the assigned faculty
 * (and admins) to view on the course Students tab. Caller enforces access
 * (admin/superadmin or faculty assigned to the course).
 */
export async function listCourseStudents(courseId: string): Promise<CourseStudentDto[]> {
  if (!Types.ObjectId.isValid(courseId)) return [];
  const enrollments = await Enrollment.find({
    courseId: new Types.ObjectId(courseId),
    status: 'active',
  }).sort({ createdAt: -1 });

  const studentIds = enrollments.map((e) => e.studentId);
  // Exclude soft-deleted students — a removed student's enrollment can linger
  // as `active` (delete doesn't cascade), so filter them out here rather than
  // surfacing a ghost row with the removed student's real name.
  const students = await User.find({ _id: { $in: studentIds }, deletedAt: null });
  const byId = new Map(students.map((s) => [String(s._id), s]));

  return enrollments
    .filter((e) => byId.has(String(e.studentId)))
    .map((e) => {
      const s = byId.get(String(e.studentId))!;
      return {
        enrollmentId: String(e._id),
        studentId: String(e.studentId),
        code: s.code ?? null,
        name: s.name,
        email: s.email,
        phoneE164: s.phoneE164,
        status: e.status,
        validFrom: e.validFrom ? e.validFrom.toISOString() : null,
        validTo: e.validTo ? e.validTo.toISOString() : null,
      };
    });
}
