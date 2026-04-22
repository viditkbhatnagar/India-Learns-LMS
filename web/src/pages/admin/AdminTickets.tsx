import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { TicketCategory, TicketState } from 'india-learns-shared-types';
import { ticketsApi } from '../../lib/endpoints.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { formatIstDate } from '../../lib/format.js';

function stateTone(state: TicketState): 'success' | 'warning' | 'info' | 'neutral' | 'danger' {
  if (state === 'resolved' || state === 'closed') return 'success';
  if (state === 'in_progress') return 'warning';
  if (state === 'open') return 'info';
  if (state === 'assigned') return 'info';
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
  const breachedCount = (query.data ?? []).filter(
    (t) => t.slaAckBreached || t.slaResolveBreached,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Tickets"
        subtitle={`${query.data?.length ?? 0} in view${breachedCount > 0 ? ` · ${breachedCount} SLA breached` : ''}`}
        action={
          breachedCount > 0 && (
            <Badge tone="danger" dot size="md">
              {breachedCount} SLA breach{breachedCount === 1 ? '' : 'es'}
            </Badge>
          )
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <label className="block flex-1 max-w-xs">
            <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
              Category
            </span>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as TicketCategory | 'all')}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="all">All categories</option>
              <option value="academic">Academic</option>
              <option value="administration">Administration</option>
              <option value="finance">Finance</option>
              <option value="technical">Technical</option>
              <option value="complaints">Complaints</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2.5 h-11 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={slaOnly}
              onChange={(e) => setSlaOnly(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 text-brand-orange focus:ring-brand-orange"
            />
            <span className="text-sm font-medium text-ink">SLA breached only</span>
          </label>
        </div>
      </Card>

      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />
      )}
      {query.data && (
        <Card className="p-0 overflow-hidden">
          {query.data.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No tickets match" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5 bg-surface-muted/40">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Raised</th>
                    <th className="py-3 px-4">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {query.data.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-brand-navy">{t.code}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <Link
                          to={`/admin/tickets/${t.id}`}
                          className="font-medium text-brand-navy hover:text-brand-orange transition-colors block truncate"
                        >
                          {t.subject}
                        </Link>
                      </td>
                      <td className="py-3 px-4 capitalize text-muted">{t.category}</td>
                      <td className="py-3 px-4">
                        <Badge tone={stateTone(t.state)} dot>
                          {t.state}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted">
                        {formatIstDate(t.createdAt)}
                      </td>
                      <td className="py-3 px-4">
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
