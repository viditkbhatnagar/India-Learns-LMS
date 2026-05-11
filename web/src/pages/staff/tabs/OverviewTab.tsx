import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { ErrorAlert, Skeleton } from '../../../components/ui/States.js';
import { assignmentsApi, coursesApi, sessionsApi, usersApi } from '../../../lib/endpoints.js';
import { ApiHttpError } from '../../../lib/api.js';
import { useAuthStore } from '../../../store/auth.js';

/** QA dashboard for the course shell — counts, grading backlog, attendance %. */
export function CourseOverviewTab({ courseId }: { courseId: string }): JSX.Element {
  const courseQ = useQuery({
    queryKey: ['course', courseId, 'shell'],
    queryFn: () => coursesApi.get(courseId),
  });
  const sessionsQ = useQuery({
    queryKey: ['course', courseId, 'sessions'],
    queryFn: () => sessionsApi.listForCourse(courseId),
  });
  const gbQ = useQuery({
    queryKey: ['gradebook', courseId],
    queryFn: () => assignmentsApi.gradebook(courseId),
  });

  if (courseQ.isLoading || sessionsQ.isLoading || gbQ.isLoading) return <Skeleton variant="card" />;
  if (courseQ.isError) return <ErrorAlert message={(courseQ.error as Error).message} />;
  if (sessionsQ.isError) return <ErrorAlert message={(sessionsQ.error as Error).message} />;
  if (gbQ.isError) return <ErrorAlert message={(gbQ.error as Error).message} />;

  const { course } = courseQ.data!;
  const sessions = sessionsQ.data ?? [];
  const gradebook = gbQ.data;
  const moduleCount = new Set(sessions.map((s) => s.moduleId)).size;
  const sessionCount = sessions.length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const completionPct = sessionCount > 0
    ? Math.round((completedCount / sessionCount) * 100)
    : 0;
  const plos = course.programLearningOutcomes ?? [];

  return (
    <div className="space-y-4">
      {/* PR #16 — program description (course summary) lifted to the top
          of the Overview tab. Falls through to a neutral hint if the
          curriculum import didn't populate one. */}
      <Card>
        <CardHeader title="About this course" />
        {course.summary ? (
          <p className="text-sm leading-relaxed text-ink/90 whitespace-pre-wrap max-w-[68ch]">
            {course.summary}
          </p>
        ) : (
          <p className="text-sm italic text-muted">
            No course description yet — admins can add one in Settings or via the curriculum import.
          </p>
        )}
      </Card>
      <TeachingFacultyCard courseId={courseId} facultyIds={course.facultyIds} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Modules" value={moduleCount} />
        <MetricCard label="Sessions" value={sessionCount} hint={`${completionPct}% complete`} />
        <MetricCard label="Assignments" value={gradebook?.assignments.length ?? 0} />
        <MetricCard
          label="Grading backlog"
          value={gradebook?.backlog ?? 0}
          tone={gradebook && gradebook.backlog > 0 ? 'warn' : 'neutral'}
        />
      </div>
      {/* Program-level learning outcomes pulled from the course's parent
          program. Read-only on this tab; admin-edit lives in Settings. */}
      <Card>
        <CardHeader
          title="Learning outcomes"
          subtitle={plos.length > 0
            ? `${plos.length} program outcome${plos.length === 1 ? '' : 's'} this course is mapped to.`
            : 'The curriculum import will populate these when a workflow is linked.'}
        />
        {plos.length === 0 ? (
          <p className="text-sm italic text-muted">No program outcomes attached to this course yet.</p>
        ) : (
          <ul className="space-y-3">
            {plos.map((p) => (
              <li
                key={p.outcomeId}
                className="rounded-xl border border-black/5 bg-white p-3 flex gap-3 items-start"
              >
                <Badge tone="info" size="sm">{p.code || `PLO ${p.outcomeNumber ?? ''}`}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink/90 max-w-[72ch]">{p.statement}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted">
                    {p.bloomLevel && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-muted">{p.bloomLevel}</span>
                    )}
                    {p.linkedKSCs.slice(0, 4).map((k) => (
                      <span key={k} className="font-mono">{k}</span>
                    ))}
                    {p.linkedKSCs.length > 4 && (
                      <span>+{p.linkedKSCs.length - 4} more</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Course progress"
          subtitle={`${completedCount} of ${sessionCount} sessions marked complete.`}
        />
        <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-brand-orange transition-all"
            style={{ width: `${completionPct}%` }}
            aria-hidden
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Drafts vs published"
          subtitle="Faculty drafts are not yet visible to students."
        />
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted font-bold">Drafts</dt>
            <dd className="text-2xl font-bold text-brand-navy mt-1">
              {gradebook?.draftCount ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted font-bold">Published</dt>
            <dd className="text-2xl font-bold text-brand-navy mt-1">
              {gradebook?.publishedCount ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted font-bold">Backlog</dt>
            <dd className="text-2xl font-bold text-brand-navy mt-1">
              {gradebook?.backlog ?? 0}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'warn';
}): JSX.Element {
  const ring = tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-black/5 bg-white';
  return (
    <div className={`rounded-xl border ${ring} p-4`}>
      <p className="text-xs uppercase tracking-wider text-muted font-bold">{label}</p>
      <p className="text-3xl font-bold text-brand-navy mt-1">{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

/**
 * PR #19 — assign faculty to a course. Logan's UAT round 5 follow-up
 * "how to assign a course to a faculty?" — until now the data model
 * supported `Course.facultyIds` and the API took it on
 * `PATCH /v1/courses/:id`, but there was no UI affordance. That gap
 * was load-bearing: every faculty write (attendance, save notes,
 * mark complete, add material, save description) is gated by
 * `assertFacultyCanWriteCourse` which checks this array — without a
 * way to set it, faculty were locked out of every course unless
 * someone hit the API directly.
 *
 * Admin / superadmin see the card with the current roster + an
 * "Add faculty" combobox. Faculty (read-only view of the same course)
 * see the same list as a roster but without the manage controls —
 * useful so they know who else is on the team.
 */
function TeachingFacultyCard({
  courseId,
  facultyIds,
}: {
  courseId: string;
  facultyIds: string[];
}): JSX.Element {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const canManage = me?.role === 'admin' || me?.role === 'superadmin';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // List of every faculty user — for the combobox + to render
  // names/emails of the current roster (the course doc only carries
  // ids).
  const facultyQ = useQuery({
    queryKey: ['users', { role: 'faculty' }],
    queryFn: () => usersApi.list({ role: 'faculty' }),
  });

  const updateMut = useMutation({
    mutationFn: (nextIds: string[]) =>
      coursesApi.update(courseId, { facultyIds: nextIds }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ['course', courseId, 'shell'] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Update failed.'),
  });

  const allFaculty = facultyQ.data ?? [];
  const facultyById = new Map(allFaculty.map((u) => [u.id, u]));
  const current = facultyIds
    .map((id) => facultyById.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const unassigned = allFaculty.filter((u) => !facultyIds.includes(u.id));

  function add(userId: string): void {
    if (!userId || facultyIds.includes(userId)) return;
    updateMut.mutate([...facultyIds, userId]);
    setPickerOpen(false);
  }
  function remove(userId: string): void {
    if (!facultyIds.includes(userId)) return;
    updateMut.mutate(facultyIds.filter((id) => id !== userId));
  }

  return (
    <Card>
      <CardHeader
        title="Teaching faculty"
        subtitle={
          canManage
            ? 'Add or remove the faculty members teaching this course. Anyone listed here can record attendance, mark sessions complete, and grade — and only they can.'
            : current.length === 0
              ? 'No faculty assigned yet — ask an admin to add you.'
              : `${current.length} faculty member${current.length === 1 ? '' : 's'} teaching this course.`
        }
      />
      {current.length === 0 ? (
        <p className="text-sm italic text-muted">
          {canManage
            ? 'No faculty yet. Add one below — without anyone here, faculty edits are blocked.'
            : 'No faculty have been assigned.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {current.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-2"
            >
              <span aria-hidden className="h-8 w-8 rounded-full bg-navy-100 text-brand-navy font-semibold grid place-items-center text-xs">
                {(u.name ?? u.email).slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-navy truncate">{u.name}</p>
                <p className="text-xs text-muted truncate">{u.email}</p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(u.id)}
                  loading={updateMut.isPending && updateMut.variables?.includes(u.id) === false}
                  className="text-danger hover:bg-red-50"
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="mt-3">
          {pickerOpen ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => add(e.target.value)}
                className="flex-1 h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              >
                <option value="" disabled>
                  {facultyQ.isLoading
                    ? 'Loading faculty…'
                    : unassigned.length === 0
                      ? 'Every faculty user is already on this course.'
                      : 'Pick a faculty member to add…'}
                </option>
                {unassigned.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPickerOpen(false);
                  setErr(null);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPickerOpen(true)}
              disabled={facultyQ.isLoading}
            >
              + Add faculty
            </Button>
          )}
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </Card>
  );
}
