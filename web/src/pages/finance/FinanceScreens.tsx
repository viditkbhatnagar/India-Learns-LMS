import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { feesApi, studentsApi, usersApi, analyticsApi } from '../../lib/endpoints.js';
import { formatIstDate, formatIstDateTime, formatMoney } from '../../lib/format.js';

// ---------- /finance/students ----------

export function FinanceStudentsPage() {
  const [q, setQ] = useState('');
  const usersQ = useQuery({
    queryKey: ['finance', 'students', q],
    queryFn: () => usersApi.list({ role: 'student', q }),
    enabled: q.length === 0 || q.length >= 2,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Students</h1>
        <p className="text-muted text-sm mt-1">Look up a student's fee position before recording a payment.</p>
      </div>
      <Card>
        <Input
          label="Search"
          placeholder="Name, email, or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </Card>
      <Card>
        {usersQ.isLoading && <Skeleton lines={4} />}
        {usersQ.isError && <ErrorAlert message={(usersQ.error as Error).message} />}
        {usersQ.data &&
          (usersQ.data.length === 0 ? (
            <EmptyState title="No students" message="Try a different search." />
          ) : (
            <ul className="divide-y divide-black/5">
              {usersQ.data.map((u) => (
                <li key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/finance/students/${u.id}`} className="font-medium text-brand-navy hover:underline">
                      {u.name}
                    </Link>
                    <p className="text-xs text-muted">{u.email}{u.code && <> · <span className="font-mono">{u.code}</span></>}</p>
                  </div>
                  <Badge tone={u.status === 'active' ? 'success' : 'warning'}>{u.status}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /finance/students/:id ----------

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
                <span className="font-mono">{formatMoney(i.balancePaise)}</span>
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
        className={`font-semibold text-xl mt-1 ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-brand-navy'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

// ---------- /finance/payments ----------

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
                    <td className="text-right font-mono">{formatMoney(p.amountPaise)}</td>
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

// ---------- /finance/payments/:id ----------

export function FinancePaymentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['payment', id],
    queryFn: () => feesApi.getPayment(id),
    enabled: !!id,
  });
  const reverse = useMutation({
    mutationFn: () => feesApi.reversePayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment', id] }),
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} />;
  if (!q.data) return null;
  const { payment, receipt } = q.data;
  const reversible =
    !payment.reversed &&
    Date.now() - new Date(payment.receivedAt).getTime() < 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/finance/payments" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <h1 className="text-display-sm text-brand-navy tracking-tight">Payment {payment.id.slice(-8)}</h1>
      <Card className="space-y-3 text-sm">
        <Row label="Received at" value={formatIstDateTime(payment.receivedAt)} />
        <Row label="Student" value={payment.studentId} mono />
        <Row label="Amount" value={formatMoney(payment.amountPaise)} />
        <Row label="Method" value={payment.method} />
        {payment.reference && <Row label="Reference" value={payment.reference} mono />}
        {payment.notes && <Row label="Notes" value={payment.notes} />}
        <Row label="Status" value={payment.reversed ? 'Reversed' : 'Recorded'} />
        {payment.reversed && payment.reversedAt && (
          <Row label="Reversed at" value={formatIstDateTime(payment.reversedAt)} />
        )}
      </Card>

      {receipt && (
        <Card>
          <CardHeader title="Receipt" />
          <p className="font-mono text-sm">{receipt.code}</p>
          <a
            href={receipt.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-orange hover:underline text-sm"
          >
            Download receipt PDF
          </a>
        </Card>
      )}

      {reversible && (
        <Card>
          <p className="text-sm text-muted">
            Within 24 hours of recording, you can reverse this payment. Reversal creates a credit note.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            loading={reverse.isPending}
            onClick={() => {
              if (confirm('Reverse this payment? A credit note will be issued.')) reverse.mutate();
            }}
          >
            Reverse payment
          </Button>
          {reverse.isError && (
            <p className="mt-2 text-sm text-danger">{(reverse.error as Error).message}</p>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-mono text-xs' : ''}>{value}</span>
    </div>
  );
}

// ---------- /finance/reports ----------

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
              Total in period: <span className="font-mono text-brand-navy">{formatMoney(total)}</span>
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
                    <td className="text-right">{r.count}</td>
                    <td className="text-right font-mono">{formatMoney(r.amountPaise)}</td>
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
