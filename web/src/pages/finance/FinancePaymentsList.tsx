import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { feesApi } from '../../lib/endpoints.js';
import { formatIstDateTime, formatMoney } from '../../lib/format.js';

export function FinancePaymentsListPage() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ['finance', 'payments', from, to],
    queryFn: () => feesApi.listPayments({ from, to }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Payments</h1>
        <p className="text-muted text-sm mt-1">Recent payments. Within 24h, a payment can be reversed (creates a credit note).</p>
      </div>
      <Card className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => q.refetch()}>
            Refresh
          </Button>
        </div>
      </Card>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No payments in this range" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">Received</th>
                  <th>Student</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {q.data.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-cream/40">
                    <td className="py-2">{formatIstDateTime(p.receivedAt)}</td>
                    <td className="font-mono text-xs">{p.studentId.slice(-8)}</td>
                    <td>{p.method}</td>
                    <td className="text-right font-mono tabular-nums">{formatMoney(p.amountPaise)}</td>
                    <td className="text-right">
                      {p.reversed ? (
                        <Badge tone="danger">reversed</Badge>
                      ) : (
                        <Badge tone="success">recorded</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <Link to={`/finance/payments/${p.id}`} className="text-brand-orange hover:underline">
                        View →
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
