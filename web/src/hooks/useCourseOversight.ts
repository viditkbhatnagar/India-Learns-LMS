import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '../lib/endpoints.js';
import { useAuthStore } from '../store/auth.js';

export interface OversightState {
  isLoading: boolean;
  /** True when the current user is viewing this course in read-only mode. */
  isOversight: boolean;
  /** True when the user is on this course's facultyIds (write-eligible). */
  canWrite: boolean;
  /** Best-effort role label for tooltips. */
  role: string | null;
}

/**
 * Mirrors the server-side rule in `assertFacultyCanWriteCourse`: writes
 * require the actor to be on `course.facultyIds`. Admin and superadmin
 * roles get oversight (read-only) until they add themselves to the
 * roster. Returns flags the UI uses to disable write CTAs and render the
 * persistent banner.
 *
 * Reuses the same query key as `CourseShell` so a single network call
 * covers both. Safe to call from any descendant of the course route.
 */
export function useCourseOversight(courseId: string | undefined): OversightState {
  const me = useAuthStore((s) => s.user);
  const courseQ = useQuery({
    queryKey: ['course', courseId, 'shell'],
    queryFn: () => coursesApi.get(courseId!),
    enabled: Boolean(courseId),
  });

  if (!courseId || !me) {
    return { isLoading: false, isOversight: false, canWrite: false, role: me?.role ?? null };
  }
  if (courseQ.isLoading || !courseQ.data) {
    return { isLoading: true, isOversight: false, canWrite: false, role: me.role };
  }
  const { course } = courseQ.data;
  const onRoster = Array.isArray(course.facultyIds)
    && course.facultyIds.some((fid: string) => fid === me.id);
  const isStaffRole = me.role === 'faculty' || me.role === 'admin' || me.role === 'superadmin';
  const canWrite = isStaffRole && onRoster;
  // Faculty role: never in oversight — they either own the course or get
  // a hard 403. Admin/superadmin: oversight whenever they're not on the roster.
  const isOversight = (me.role === 'admin' || me.role === 'superadmin') && !onRoster;
  return {
    isLoading: false,
    isOversight,
    canWrite,
    role: me.role,
  };
}
