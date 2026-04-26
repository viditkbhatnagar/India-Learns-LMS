import { createContext, useContext, type ReactNode } from 'react';

/**
 * Oversight state derived once at the course shell level. Every nested
 * route (SessionDetail, MaterialViewer, AssignmentGrading, …) reads from
 * this context instead of recomputing — single source of truth, single
 * fetch via the shared `['course', id, 'shell']` query key in
 * `CourseShell`.
 *
 * Mirrors the server-side rule in `assertFacultyCanWriteCourse`:
 *   - canWrite: actor is on `course.facultyIds`
 *   - isOversight: actor is admin/superadmin AND not on facultyIds
 *   - faculty role never lands in oversight (they either own or get 403)
 */
export interface CourseOversightValue {
  isOversight: boolean;
  canWrite: boolean;
  /** ID of the course this context covers — useful for child queries. */
  courseId: string;
}

const CourseOversightContext = createContext<CourseOversightValue | null>(null);

export function CourseOversightProvider({
  value,
  children,
}: {
  value: CourseOversightValue;
  children: ReactNode;
}) {
  return (
    <CourseOversightContext.Provider value={value}>
      {children}
    </CourseOversightContext.Provider>
  );
}

/**
 * Throws if used outside a `<CourseOversightProvider>`. The course shell
 * always wraps its `<Routes>`, so any descendant of `/courses/:id/*` is
 * safe to call this. Callers that want to opt out of the throw can use
 * `useOptionalCourseOversight()`.
 */
export function useCourseOversight(): CourseOversightValue {
  const ctx = useContext(CourseOversightContext);
  if (!ctx) {
    throw new Error(
      'useCourseOversight must be used inside <CourseOversightProvider> — '
      + 'mount the CourseShell at /courses/:id/*.',
    );
  }
  return ctx;
}

export function useOptionalCourseOversight(): CourseOversightValue | null {
  return useContext(CourseOversightContext);
}
