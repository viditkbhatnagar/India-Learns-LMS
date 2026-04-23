import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { ticketsApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

export function AdminSlaBreachesPage() {
  const q = useQuery({
    queryKey: ['admin', 'tickets', 'sla-breaches'],
    queryFn: () => ticketsApi.listAdmin({ slaBreached: 'any' }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">SLA breaches</h1>
        <p className="text-muted text-sm mt-1">
          Tickets that missed the 24h ack or 5d (15bd for complaints) resolve target.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No SLA breaches in scope" message="Excellent." />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/admin/tickets/${t.id}`} className="font-medium text-brand-navy hover:underline">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted">
                      <span className="font-mono">{t.code}</span> · {t.category} · since{' '}
                      {formatIstDateTime(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {t.slaAckBreached && <Badge tone="danger">ack</Badge>}
                    {t.slaResolveBreached && <Badge tone="danger">resolve</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
