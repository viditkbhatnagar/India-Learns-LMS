import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { ErrorAlert, Skeleton } from '../../../components/ui/States.js';
import { assignmentsApi, sessionsApi } from '../../../lib/endpoints.js';

/** QA dashboard for the course shell — counts, grading backlog, attendance %. */
export function CourseOverviewTab({ courseId }: { courseId: string }): JSX.Element {
  const sessionsQ = useQuery({
    queryKey: ['course', courseId, 'sessions'],
    queryFn: () => sessionsApi.listForCourse(courseId),
  });
  const gbQ = useQuery({
    queryKey: ['gradebook', courseId],
    queryFn: () => assignmentsApi.gradebook(courseId),
  });

  if (sessionsQ.isLoading || gbQ.isLoading) return <Skeleton variant="card" />;
  if (sessionsQ.isError) return <ErrorAlert message={(sessionsQ.error as Error).message} />;
  if (gbQ.isError) return <ErrorAlert message={(gbQ.error as Error).message} />;

  const sessions = sessionsQ.data ?? [];
  const gradebook = gbQ.data;
  const moduleCount = new Set(sessions.map((s) => s.moduleId)).size;
  const sessionCount = sessions.length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const completionPct = sessionCount > 0
    ? Math.round((completedCount / sessionCount) * 100)
    : 0;

  return (
    <div className="space-y-4">
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
