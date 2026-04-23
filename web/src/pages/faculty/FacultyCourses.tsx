import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { facultyApi } from '../../lib/endpoints.js';
import { useAuthStore } from '../../store/auth.js';

export function FacultyCoursesPage() {
  const me = useAuthStore((s) => s.user)!;
  const q = useQuery({ queryKey: ['faculty', 'courses'], queryFn: facultyApi.myCourses });
  const mine = useMemo(
    () => (q.data ?? []).filter((c) => c.facultyIds?.includes(me.id)),
    [q.data, me.id],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">My courses</h1>
        <p className="text-muted text-sm mt-1">
          Courses you're assigned to teach. Open one to manage sessions, post announcements, and review progress.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (mine.length === 0 ? (
            <EmptyState title="No courses assigned" message="Admin will assign you to a course shortly." />
          ) : (
            <ul className="divide-y divide-black/5">
              {mine.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/faculty/courses/${c.id}`} className="font-medium text-brand-navy hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      {c.slug} · v{c.publishedVersion ?? 0}
                    </p>
                  </div>
                  <Badge tone={c.state === 'published' ? 'success' : 'warning'}>{c.state}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
