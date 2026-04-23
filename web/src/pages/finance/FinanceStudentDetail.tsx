import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { studentsApi, usersApi } from '../../lib/endpoints.js';
import { formatIstDate, formatIstDateTime, formatMoney } from '../../lib/format.js';

export function FinanceStudentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const userQ = useQuery({ queryKey: ['user', id], queryFn: () => usersApi.get(id), enabled: !!id });
  const feesQ = useQuery({
    queryKey: ['finance', 'student-fees', id],
    queryFn: () => studentsApi.feesFor(id),
    enabled: !!id,
  });

  if (userQ.isLoading || feesQ.isLoading) return <Skeleton lines={6} />;
  if (userQ.isError) return <ErrorAlert message={(userQ.error as Error).message} />;
  if (feesQ.isError) return <ErrorAlert message={(feesQ.error as Error).message} />;
  const user = userQ.data!;
  const fees = feesQ.data!;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">{user.name}</h1>
          <p className="text-muted text-sm mt-1">
            {user.email} · {user.code && <span className="font-mono">{user.code}</span>}
          </p>
        </div>
        <Link to={`/finance/students/${id}/record-payment`}>
          <Button>Record payment</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total" value={formatMoney(fees.totalPaise)} />
        <Stat label="Paid" value={formatMoney(fees.paidPaise)} tone="success" />
        <Stat label="Outstanding" value={formatMoney(fees.balancePaise)} tone="danger" />
      </div>

      <Card>
        <CardHeader title="Installments" />
        {fees.installments.length === 0 ? (
          <EmptyState title="No installments" />
        ) : (
          <ul className="divide-y divide-black/5">
            {fees.installments.map((i) => (
              <li key={i.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-brand-navy">{i.label}</p>
                  <p className="text-xs text-muted">due {formatIstDate(i.dueDate)} · status {i.status}</p>
                </div>
                <span className="font-mono tabular-nums">{formatMoney(i.balancePaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Receipts" />
        {fees.receipts.length === 0 ? (
          <EmptyState title="No receipts yet" />
        ) : (
          <ul className="divide-y divide-black/5">
            {fees.receipts.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-brand-navy font-mono">{r.code}</p>
                  <p className="text-xs text-muted">issued {formatIstDateTime(r.issuedAt)}</p>
                </div>
                <a
                  href={r.pdfUrl}
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p
        className={`font-semibold text-xl mt-1 font-mono tabular-nums ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-brand-navy'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
