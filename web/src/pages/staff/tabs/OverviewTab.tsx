import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { ErrorAlert, Skeleton } from '../../../components/ui/States.js';
import { assignmentsApi, coursesApi, sessionsApi } from '../../../lib/endpoints.js';

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
