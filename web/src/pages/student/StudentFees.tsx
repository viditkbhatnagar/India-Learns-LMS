import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatMoney, formatIstDate } from '../../lib/format.js';

export function StudentFees() {
  const query = useQuery({
    queryKey: ['me', 'fees'],
    queryFn: studentsApi.fees,
  });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const fees = query.data!;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">My fees</h1>

      {fees.accessState !== 'active' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-warning p-4">
          <p className="font-semibold">Access status: {fees.accessState}</p>
          <p className="text-sm mt-0.5">
            {fees.accessState === 'suspended'
              ? 'Your access has been suspended due to unpaid fees. Please contact finance.'
              : 'Your account is flagged for overdue fees. Pay soon to keep your access.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">Total due</p>
          <p className="font-semibold text-2xl text-brand-navy mt-1">{formatMoney(fees.totalPaise)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">Paid</p>
          <p className="font-semibold text-2xl text-success mt-1">{formatMoney(fees.paidPaise)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">Outstanding</p>
          <p className={`font-semibold text-2xl mt-1 ${fees.balancePaise > 0 ? 'text-danger' : 'text-brand-navy'}`}>
            {formatMoney(fees.balancePaise)}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Installments" subtitle={fees.nextDueDate ? `Next due: ${formatIstDate(fees.nextDueDate)}` : undefined} />
        {fees.installments.length === 0 ? (
          <EmptyState title="No installments" message="Once an invoice is generated your installments will appear here." />
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-sm min-w-[540px]">
              <thead className="text-left text-muted text-xs uppercase">
                <tr>
                  <th className="py-2 px-2">Label</th>
                  <th className="py-2 px-2">Due date</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-2 text-right">Paid</th>
                  <th className="py-2 px-2 text-right">Balance</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {fees.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td className="py-2 px-2">{inst.label}</td>
                    <td className="py-2 px-2">{formatIstDate(inst.dueDate)}</td>
                    <td className="py-2 px-2 text-right mono">{formatMoney(inst.amountPaise)}</td>
                    <td className="py-2 px-2 text-right mono text-success">{formatMoney(inst.paidPaise)}</td>
                    <td className="py-2 px-2 text-right mono">{formatMoney(inst.balancePaise)}</td>
                    <td className="py-2 px-2">
                      <Badge tone={inst.status === 'paid' ? 'success' : inst.status === 'overdue' ? 'danger' : 'warning'}>
                        {inst.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Receipts" />
        {fees.receipts.length === 0 ? (
          <EmptyState title="No receipts yet" />
        ) : (
          <ul className="divide-y divide-black/5">
            {fees.receipts.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium mono">{r.code}</p>
                  <p className="text-xs text-muted">{formatIstDate(r.issuedAt)}</p>
                </div>
                <a
                  href={`/v1/receipts/${r.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-orange hover:underline"
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
