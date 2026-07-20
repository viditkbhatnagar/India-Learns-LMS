import { type JSX } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../../components/ui/States.js';
import { courseStudentsApi } from '../../../lib/endpoints.js';
import { formatIstDate } from '../../../lib/format.js';

/**
 * Course Students roster — replaces the earlier "coming soon" stub. Lists the
 * students actively enrolled in the course. Visible to admins and the faculty
 * assigned to the course (the API enforces the same gate).
 */
export function CourseStudentsTab(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const courseId = id ?? '';
  const q = useQuery({
    queryKey: ['course', courseId, 'students'],
    queryFn: () => courseStudentsApi.list(courseId),
    enabled: Boolean(courseId),
  });

  if (q.isLoading) return <Skeleton variant="card" />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;

  const students = q.data ?? [];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 pb-0">
        <CardHeader
          title="Students"
          subtitle={`${students.length} enrolled ${students.length === 1 ? 'student' : 'students'}`}
        />
      </div>
      {students.length === 0 ? (
        <div className="p-5 pt-0">
          <EmptyState
            title="No students enrolled yet"
            message="Students appear here once they're enrolled into this course from the admin Enrolments screen."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-black/5 bg-surface-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-brand-navy whitespace-nowrap">Code</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">Name</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">Email</th>
                <th className="px-4 py-3 font-semibold text-brand-navy whitespace-nowrap">Enrolled until</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.enrollmentId}
                  className="border-b border-black/5 last:border-0 hover:bg-surface-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{s.code ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-brand-navy">{s.name}</td>
                  <td className="px-4 py-3 text-ink/90">{s.email}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {s.validTo ? formatIstDate(s.validTo) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
