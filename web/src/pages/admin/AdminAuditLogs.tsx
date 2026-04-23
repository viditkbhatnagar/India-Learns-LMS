import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { auditLogApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

export function AdminAuditLogsPage() {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'audit-logs', actorId, action],
    queryFn: () => auditLogApi.list({ actorId: actorId || undefined, action: action || undefined, limit: 200 }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Audit log</h1>
        <p className="text-muted text-sm mt-1">Every staff write — who did what, when.</p>
      </div>
      <Card className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Actor ID" value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="user _id" />
        <Input label="Action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. payment.recorded" />
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => q.refetch()}>
            Apply
          </Button>
        </div>
      </Card>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No matching log entries" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {(q.data as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i}>
                    <td className="py-2">{formatIstDateTime(String(row.at ?? row.createdAt))}</td>
                    <td className="font-mono text-xs">{String(row.actorUserId ?? row.actorId ?? '')}</td>
                    <td>{String(row.action)}</td>
                    <td className="font-mono text-xs">{String(row.targetId ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Card>
    </div>
  );
}
