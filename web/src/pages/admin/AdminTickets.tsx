import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { TicketCategory, TicketState } from 'india-learns-shared-types';
import { ticketsApi } from '../../lib/endpoints.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

function stateTone(state: TicketState): 'success' | 'warning' | 'info' | 'neutral' | 'danger' {
  if (state === 'resolved' || state === 'closed') return 'success';
  if (state === 'in_progress') return 'warning';
  if (state === 'open') return 'info';
  return 'neutral';
}

export function AdminTickets() {
  const [cat, setCat] = useState<TicketCategory | 'all'>('all');
  const [slaOnly, setSlaOnly] = useState(false);
  const query = useQuery({
    queryKey: ['admin', 'tickets', cat, slaOnly],
    queryFn: () =>
      ticketsApi.listAdmin({
        ...(cat !== 'all' ? { category: cat } : {}),
        ...(slaOnly ? { slaBreached: 'true' } : {}),
      }),
  });
  const breachedCount = (query.data ?? []).filter((t) => t.slaAckBreached || t.slaResolveBreached).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">Tickets</h1>
        {breachedCount > 0 && (
          <Badge tone="danger">{breachedCount} SLA breach{breachedCount === 1 ? '' : 'es'}</Badge>
        )}
      </div>
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as TicketCategory | 'all')}
            className="h-10 px-3 rounded-lg border border-black/10 bg-white"
          >
            <option value="all">All categories</option>
            <option value="academic">Academic</option>
            <option value="administration">Administration</option>
            <option value="finance">Finance</option>
            <option value="technical">Technical</option>
            <option value="complaints">Complaints</option>
          </select>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={slaOnly}
              onChange={(e) => setSlaOnly(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 text-brand-orange focus:ring-brand-orange"
            />
            <span className="text-sm">SLA breached only</span>
          </label>
        </div>
      </Card>
      {query.isLoading && <Skeleton lines={6} />}
      {query.isError && <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && (
        <Card>
          {query.data.length === 0 ? (
            <EmptyState title="No tickets match" />
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-muted text-xs uppercase">
                  <tr>
                    <th className="py-2 px-2">Code</th>
                    <th className="py-2 px-2">Subject</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">State</th>
                    <th className="py-2 px-2">Raised</th>
                    <th className="py-2 px-2">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {query.data.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 px-2 mono">{t.code}</td>
                      <td className="py-2 px-2">
                        <Link to={`/admin/tickets/${t.id}`} className="text-brand-navy hover:underline">{t.subject}</Link>
                      </td>
                      <td className="py-2 px-2 capitalize">{t.category}</td>
                      <td className="py-2 px-2"><Badge tone={stateTone(t.state)}>{t.state}</Badge></td>
                      <td className="py-2 px-2 text-xs">{formatIstDate(t.createdAt)}</td>
                      <td className="py-2 px-2">
                        {t.slaResolveBreached ? (
                          <Badge tone="danger">Resolve</Badge>
                        ) : t.slaAckBreached ? (
                          <Badge tone="warning">Ack</Badge>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
