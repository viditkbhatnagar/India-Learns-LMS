import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { facultyApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

export function FacultyGradingQueuePage() {
  const q = useQuery({ queryKey: ['faculty', 'grading'], queryFn: facultyApi.gradingQueue });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Grading queue</h1>
        <p className="text-muted text-sm mt-1">
          Exam attempts awaiting essay grading from your courses.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="Nothing in your queue" message="When students submit essays, they'll appear here." />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link
                      to={`/faculty/grading/${a.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      Attempt {a.id.slice(-6)}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      Student {a.studentId.slice(-6)} · submitted {a.submittedAt ? formatIstDateTime(a.submittedAt) : 'in progress'}
                    </p>
                  </div>
                  <Badge tone="warning">awaiting grade</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
