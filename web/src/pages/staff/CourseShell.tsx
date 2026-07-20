import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useState, type JSX } from 'react';
import { coursesApi } from '../../lib/endpoints.js';
import { RequestErrorState, Skeleton } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { useAuthStore } from '../../store/auth.js';
import { ApiHttpError } from '../../lib/api.js';
import { CourseOversightProvider } from '../../contexts/CourseOversightContext.js';
// Eager: small, mounted on the default tab. Lazy: heavy (DnD libs,
// rubric form, attendance roster) — only loaded when the user navigates
// to the corresponding tab. Cuts ~280 KB out of the gradebook/overview
// initial chunk so faculty users on those tabs don't pay the @dnd-kit
// cost.
import { CourseOverviewTab } from './tabs/OverviewTab.js';
import { CourseGradebookTab } from './tabs/GradebookTab.js';
import { CourseAnnouncementsStub, CourseSettingsStub } from './tabs/Stubs.js';
import { CourseStudentsTab } from './tabs/CourseStudentsTab.js';
import { CourseGlossaryTab, CourseReadingListTab } from './tabs/GlossaryReadingTab.js';

const CourseContentTab = lazy(() =>
  import('./tabs/ContentTab.js').then((m) => ({ default: m.CourseContentTab })),
);
const SessionDetailPage = lazy(() =>
  import('./SessionDetail.js').then((m) => ({ default: m.SessionDetailPage })),
);
const AssignmentGradingPage = lazy(() =>
  import('./AssignmentGrading.js').then((m) => ({ default: m.AssignmentGradingPage })),
);
const MaterialViewerPage = lazy(() =>
  import('./MaterialViewer.js').then((m) => ({ default: m.MaterialViewerPage })),
);

function TabFallback(): JSX.Element {
  return <Skeleton variant="card" />;
}

const TABS: Array<{ slug: string; label: string }> = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'content', label: 'Content' },
  { slug: 'glossary', label: 'Glossary' },
  { slug: 'reading-list', label: 'Reading list' },
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const courseQ = useQuery({
    queryKey: ['course', id, 'shell'],
    queryFn: () => coursesApi.get(id),
    enabled: Boolean(id),
  });

  const deleteMut = useMutation({
    mutationFn: () => coursesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      navigate('/admin/courses');
    },
    onError: (e) => setDeleteError(e instanceof ApiHttpError ? e.message : 'Delete failed.'),
  });

  // M10s — Publish + Unpublish. Faculty on roster can now do this too
  // (backend enforces facultyAssignedToCourse).
  const [publishError, setPublishError] = useState<string | null>(null);
  const publishMut = useMutation({
    mutationFn: () => coursesApi.publish(id),
    onSuccess: () => {
      setPublishError(null);
      qc.invalidateQueries({ queryKey: ['course', id, 'shell'] });
    },
    onError: (e) => setPublishError(e instanceof ApiHttpError ? e.message : 'Publish failed.'),
  });
  const unpublishMut = useMutation({
    mutationFn: () => coursesApi.unpublish(id),
    onSuccess: () => {
      setPublishError(null);
      qc.invalidateQueries({ queryKey: ['course', id, 'shell'] });
    },
    onError: (e) => setPublishError(e instanceof ApiHttpError ? e.message : 'Unpublish failed.'),
  });

  if (!id) {
    return <RequestErrorState error={new Error('Course id missing from URL.')} />;
  }
  if (courseQ.isLoading) return <Skeleton variant="card" />;
  if (courseQ.isError) {
    return (
      <RequestErrorState
        error={courseQ.error}
        onRetry={() => courseQ.refetch()}
      />
    );
  }
  if (!courseQ.data) return <Skeleton variant="card" />;

  const { course } = courseQ.data;
  const onRoster = Array.isArray(course.facultyIds)
    && course.facultyIds.some((fid: string) => fid === me?.id);
  // Oversight = admin/superadmin who isn't on this course's faculty roster.
  // Server enforces the same rule in `assertFacultyCanWriteCourse`; the UI
  // mirrors it so users don't waste a click discovering that Save is
  // forbidden. Faculty role never lands in oversight — they either own the
  // course or get a hard 403 upstream.
  const isOversight = (me?.role === 'admin' || me?.role === 'superadmin') && !onRoster;
  // Reuse the same flag in writes from descendants via context — faculty
  // (on roster) gets canWrite=true; oversight gets canWrite=false.
  const canWrite = me?.role === 'faculty' ? Boolean(onRoster)
    : (me?.role === 'admin' || me?.role === 'superadmin') ? Boolean(onRoster)
      : false;
  // Sandbox courses are safe to delete; published ones require unpublish
  // first per the API rule. Surface the action in the header for staff
  // who can act on it (admin/superadmin) AND who are on the roster — the
  // delete UI is hidden in oversight mode (FUT-3 — same root cause as
  // attendance/notes write protection).
  const canManage = me?.role === 'admin' || me?.role === 'superadmin';
  const canDelete = !isOversight && canManage && course.state === 'sandbox';

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
          <div className="flex items-center gap-2 flex-wrap">
            {canWrite && course.state === 'sandbox' && (
              <Button
                size="sm"
                loading={publishMut.isPending}
                onClick={() => publishMut.mutate()}
              >
                Publish course
              </Button>
            )}
            {canWrite && course.state === 'published' && (
              <Button
                size="sm"
                variant="secondary"
                loading={unpublishMut.isPending}
                onClick={() => {
                  if (
                    confirm(
                      'Unpublish this course? Students will lose access until you publish again.',
                    )
                  ) {
                    unpublishMut.mutate();
                  }
                }}
              >
                Unpublish
              </Button>
            )}
            {canDelete && !confirmDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-danger hover:bg-red-50"
              >
                Delete course
              </Button>
            )}
          </div>
        </div>
        {publishError && (
          <div className="px-5 pb-3">
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 p-2.5 text-sm text-danger"
            >
              {publishError}
            </div>
          </div>
        )}
        {confirmDelete && canDelete && (
          <div className="px-5 pb-3">
            <div className="rounded-xl border border-danger/30 bg-red-50 p-3 text-sm text-danger flex items-center justify-between gap-3 flex-wrap">
              <span>Delete <strong>{course.name}</strong>? This cannot be undone.</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleteMut.isPending}
                  onClick={() => deleteMut.mutate()}
                >
                  Confirm delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
            {deleteError && <p className="text-xs text-danger mt-1">{deleteError}</p>}
          </div>
        )}
        {isOversight && (
          <div
            role="alert"
            data-testid="oversight-banner"
            className="mx-5 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 flex items-start gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            <div>
              You're viewing this course in oversight mode — edits are disabled. To enable
              editing, assign a teaching faculty member on the Overview tab (admins/superadmins
              aren't added to course rosters; a faculty member makes the edits).
            </div>
          </div>
        )}
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

      <CourseOversightProvider value={{ isOversight, canWrite, courseId: id }}>
        <Suspense fallback={<TabFallback />}>
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<CourseOverviewTab courseId={id} />} />
            <Route path="content" element={<CourseContentTab courseId={id} />} />
            <Route path="glossary" element={<CourseGlossaryTab courseId={id} />} />
            <Route path="reading-list" element={<CourseReadingListTab courseId={id} />} />
            <Route path="gradebook" element={<CourseGradebookTab courseId={id} />} />
            <Route path="students" element={<CourseStudentsTab />} />
            <Route path="announcements" element={<CourseAnnouncementsStub courseId={id} />} />
            <Route path="settings" element={<CourseSettingsStub />} />
            <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
            <Route
              path="sessions/:sessionId/materials/:materialId"
              element={<MaterialViewerPage />}
            />
            <Route path="assignments/:assignmentId/grading" element={<AssignmentGradingPage />} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
        </Suspense>
      </CourseOversightProvider>
    </div>
  );
}
