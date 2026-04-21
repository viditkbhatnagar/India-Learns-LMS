import { Types } from 'mongoose';
import { Course, Enrollment } from '../models/index.js';
import { HttpError } from '../middleware/error.js';

// Helper for M7 routes: faculty may only act on courses they own (Course.facultyIds
// contains the user's id). Admin + superadmin bypass the ownership check.
// Returns the resolved Course for callers that already need it.
export async function assertFacultyOwnsCourse(
  userId: Types.ObjectId,
  role: string,
  courseId: Types.ObjectId | string,
): Promise<void> {
  if (role === 'admin' || role === 'superadmin') return;
  if (role !== 'faculty') {
    throw new HttpError(403, 'FORBIDDEN', 'Role not permitted to act on this course.');
  }
  if (!Types.ObjectId.isValid(courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const course = await Course.findById(courseId).select('facultyIds deletedAt');
  if (!course || course.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const owns = course.facultyIds.some((id) => id.equals(userId));
  if (!owns) {
    throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
  }
}

export async function assertStudentEnrolledInCourse(
  studentId: Types.ObjectId,
  courseId: Types.ObjectId | string,
): Promise<void> {
  if (!Types.ObjectId.isValid(courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const enrolment = await Enrollment.findOne({
    studentId,
    courseId,
    status: 'active',
  }).select('_id');
  if (!enrolment) {
    throw new HttpError(403, 'FORBIDDEN', 'Not enrolled in this course.');
  }
}
