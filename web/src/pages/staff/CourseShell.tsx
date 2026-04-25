import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy, type JSX } from 'react';
import { coursesApi } from '../../lib/endpoints.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';
import { useAuthStore } from '../../store/auth.js';
// Eager: small, mounted on the default tab. Lazy: heavy (DnD libs,
// rubric form, attendance roster) — only loaded when the user navigates
// to the corresponding tab. Cuts ~280 KB out of the gradebook/overview
// initial chunk so faculty users on those tabs don't pay the @dnd-kit
// cost.
import { CourseOverviewTab } from './tabs/OverviewTab.js';
import { CourseGradebookTab } from './tabs/GradebookTab.js';
import { CourseStudentsStub, CourseAnnouncementsStub, CourseSettingsStub } from './tabs/Stubs.js';

const CourseContentTab = lazy(() =>
  import('./tabs/ContentTab.js').then((m) => ({ default: m.CourseContentTab })),
);
const SessionDetailPage = lazy(() =>
  import('./SessionDetail.js').then((m) => ({ default: m.SessionDetailPage })),
);
const AssignmentGradingPage = lazy(() =>
  import('./AssignmentGrading.js').then((m) => ({ default: m.AssignmentGradingPage })),
);

function TabFallback(): JSX.Element {
  return <Skeleton variant="card" />;
}

const TABS: Array<{ slug: string; label: string }> = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'content', label: 'Content' },
  { slug: 'gradebook', label: 'Gradebook' },
  { slug: 'students', label: 'Students' },
  { slug: 'announcements', label: 'Announcements' },
  { slug: 'settings', label: 'Settings' },
];

/**
 * Phase B-2 sticky course header + 6 tabs. Mounted at /courses/:id/*.
 * Shared by faculty + admin + superadmin; each tab decides what to render
 * based on `me.role`. Oversight banner shown when superadmin views a
 * course they don't teach.
 */
export function CourseShell(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);

  const courseQ = useQuery({
    queryKey: ['course', id, 'shell'],
    queryFn: () => coursesApi.get(id),
    enabled: Boolean(id),
  });

  if (!id) return <ErrorAlert message="Course id missing from URL." />;
  if (courseQ.isLoading) return <Skeleton variant="card" />;
  if (courseQ.isError) {
    return <ErrorAlert message={(courseQ.error as Error).message} onRetry={() => courseQ.refetch()} />;
  }
  if (!courseQ.data) return <Skeleton variant="card" />;

  const { course } = courseQ.data;
  const isFacultyOnCourse = me?.role === 'faculty'
    && course.facultyIds?.some((fid: string) => fid === me.id);
  const isOversight = me?.role === 'superadmin' || (me?.role === 'admin' && !isFacultyOnCourse);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-black/5 bg-white shadow-sm">
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted font-bold">Course</p>
            <h1 className="text-display-sm text-brand-navy tracking-tight truncate">{course.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge tone={course.state === 'published' ? 'success' : 'warning'} dot>
                {course.state}
              </Badge>
              <span className="font-mono text-xs text-muted">{course.slug}</span>
            </div>
          </div>
          {isOversight && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold px-3 py-1.5">
              Oversight mode
            </span>
          )}
        </div>
        <nav className="flex items-end gap-1 px-5 -mb-px overflow-x-auto" aria-label="Course tabs">
          {TABS.map((t) => (
            <NavLink
              key={t.slug}
              to={t.slug}
              className={({ isActive }) =>
                [
                  'px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-brand-orange text-brand-navy font-semibold'
                    : 'border-transparent text-muted hover:text-brand-navy hover:border-black/10',
                ].join(' ')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Suspense fallback={<TabFallback />}>
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<CourseOverviewTab courseId={id} />} />
          <Route path="content" element={<CourseContentTab courseId={id} />} />
          <Route path="gradebook" element={<CourseGradebookTab courseId={id} />} />
          <Route path="students" element={<CourseStudentsStub />} />
          <Route path="announcements" element={<CourseAnnouncementsStub courseId={id} />} />
          <Route path="settings" element={<CourseSettingsStub />} />
          <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="assignments/:assignmentId/grading" element={<AssignmentGradingPage />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
