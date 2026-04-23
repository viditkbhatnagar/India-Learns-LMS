import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { analyticsApi } from '../../lib/endpoints.js';
import { formatMoney } from '../../lib/format.js';

export function FinanceReportsPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const q = useQuery({
    queryKey: ['analytics', 'collections', from, to],
    queryFn: () => analyticsApi.collections(from, to),
  });
  const total = q.data?.totalPaise ?? 0;
  function downloadCsv() {
    if (!q.data) return;
    const rows = [
      ['Day', 'Mode', 'Component', 'Amount (paise)', 'Count'],
      ...q.data.rows.map((r) => [r.day, r.mode, r.component, r.amountPaise, r.count]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collections-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Collections report</h1>
        <p className="text-muted text-sm mt-1">Daily collections by payment method.</p>
      </div>
      <Card className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex items-end gap-2">
          <Button variant="secondary" onClick={() => q.refetch()}>
            Refresh
          </Button>
          <Button onClick={downloadCsv} disabled={!q.data}>
            Download CSV
          </Button>
        </div>
      </Card>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <p className="text-sm text-muted mb-3">
              Total in period: <span className="font-mono tabular-nums text-brand-navy">{formatMoney(total)}</span>
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">Day</th>
                  <th>Mode</th>
                  <th>Component</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {q.data.rows.map((r, i) => (
                  <tr key={`${r.day}-${r.mode}-${r.component}-${i}`}>
                    <td className="py-2">{r.day}</td>
                    <td>{r.mode}</td>
                    <td>{r.component}</td>
                    <td className="text-right tabular-nums">{r.count}</td>
                    <td className="text-right font-mono tabular-nums">{formatMoney(r.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
