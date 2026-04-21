import { useQuery } from '@tanstack/react-query';
import { certificatesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

export function StudentCertificates() {
  const query = useQuery({ queryKey: ['me', 'certificates'], queryFn: certificatesApi.listMine });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">My certificates</h1>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No certificates yet"
            message="Once you complete a course (all modules opened + quizzes passed + final exam passed), your certificate appears here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((c) => (
            <Card key={c.enrollmentId}>
              <CardHeader
                title={c.courseName}
                subtitle={c.issuedAt ? `Issued ${formatIstDate(c.issuedAt)}` : 'Awaiting issue'}
                action={
                  c.certificateUrl ? (
                    <Badge tone="success">Issued</Badge>
                  ) : c.issueError ? (
                    <Badge tone="danger">Failed</Badge>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )
                }
              />
              {c.certificateUrl ? (
                <a href={c.certificateUrl} target="_blank" rel="noreferrer">
                  <Button>View / download</Button>
                </a>
              ) : (
                <p className="text-sm text-muted">
                  {c.issueError ?? 'Your certificate is queued. Admin has been notified and will retry automatically.'}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
