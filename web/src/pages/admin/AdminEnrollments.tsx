import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EnrollmentDto } from 'india-learns-shared-types';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { adminEnrollmentsApi } from '../../lib/endpoints.js';
import { formatIstDate } from '../../lib/format.js';

export function AdminEnrollmentsPage() {
  const q = useQuery({ queryKey: ['admin', 'enrollments'], queryFn: () => adminEnrollmentsApi.list() });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Enrolments</h1>
        <p className="text-muted text-sm mt-1">All student–course relationships across batches.</p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No enrolments yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">Student</th>
                  <th>Course</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th className="text-right">Valid to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {q.data.map((e: EnrollmentDto) => (
                  <tr key={e.id}>
                    <td className="py-2 font-mono text-xs">{e.studentId.slice(-8)}</td>
                    <td className="font-mono text-xs">{e.courseId.slice(-8)}</td>
                    <td className="font-mono text-xs">{e.batchId.slice(-8)}</td>
                    <td>
                      <Badge tone={e.accessState === 'active' ? 'success' : e.accessState === 'suspended' ? 'danger' : 'warning'}>
                        {e.accessState}
                      </Badge>
                    </td>
                    <td className="text-right">{formatIstDate(e.validTo)}</td>
                    <td className="text-right">
                      <Link to={`/admin/enrollments/${e.id}`} className="text-brand-orange hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Card>
    </div>
  );
}
