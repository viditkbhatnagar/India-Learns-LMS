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
  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const fees = query.data!;
  const payPercent = fees.totalPaise > 0 ? Math.min(100, Math.round((fees.paidPaise / fees.totalPaise) * 100)) : 0;

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Billing
        </p>
        <h1 className="text-display-sm text-brand-navy">My fees</h1>
        <p className="mt-2 text-muted">Installment schedule, payments, and receipts.</p>
      </header>

      {fees.accessState !== 'active' && (
        <div
          role="alert"
          className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3 animate-fade-in ${
            fees.accessState === 'suspended'
              ? 'border-danger/30 bg-red-50 text-danger'
              : 'border-amber-300 bg-amber-50 text-warning'
          }`}
        >
          <span aria-hidden className="mt-0.5 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m12 3 10 18H2Z" />
              <path d="M12 9v4M12 17h0" />
            </svg>
          </span>
          <div>
            <p className="font-semibold">Access status: {fees.accessState}</p>
            <p className="text-sm opacity-90 mt-0.5">
              {fees.accessState === 'suspended'
                ? 'Your access has been suspended due to unpaid fees. Please contact finance.'
                : 'Your account is flagged for overdue fees. Pay soon to keep your access.'}
            </p>
          </div>
        </div>
      )}

      {/* Big balance summary + progress bar. */}
      <Card accent="orange" className="overflow-hidden">
        <div className="grid gap-5 md:grid-cols-[1.2fr,1fr] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-semibold">Outstanding balance</p>
            <p
              className={`mt-2 text-display-md tracking-tight count-up ${
                fees.balancePaise > 0 ? 'text-brand-navy' : 'text-success'
              }`}
            >
              {formatMoney(fees.balancePaise)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {fees.nextDueDate
                ? `Next installment due ${formatIstDate(fees.nextDueDate)} — ${formatMoney(fees.nextDueAmountPaise ?? 0)}`
                : 'All installments settled.'}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm mb-2">
              <span className="text-muted">Progress</span>
              <span className="font-bold text-brand-navy count-up">{payPercent}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full bg-accent-gradient rounded-full transition-all duration-700 ease-bounce"
                style={{ width: `${payPercent}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted uppercase tracking-wider font-semibold">Paid</p>
                <p className="font-bold text-success count-up mt-1">{formatMoney(fees.paidPaise)}</p>
              </div>
              <div>
                <p className="text-muted uppercase tracking-wider font-semibold">Total</p>
                <p className="font-bold text-brand-navy count-up mt-1">{formatMoney(fees.totalPaise)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Installments timeline/table */}
      <Card accent="navy">
        <CardHeader
          title="Installments"
          subtitle={
            fees.nextDueDate
              ? `Next due: ${formatIstDate(fees.nextDueDate)}`
              : 'No upcoming installments'
          }
        />
        {fees.installments.length === 0 ? (
          <EmptyState
            title="No installments"
            message="Once an invoice is generated your installments will appear here."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5">
                  <th className="py-3 pr-4">Label</th>
                  <th className="py-3 pr-4">Due date</th>
                  <th className="py-3 pr-4 text-right">Amount</th>
                  <th className="py-3 pr-4 text-right">Paid</th>
                  <th className="py-3 pr-4 text-right">Balance</th>
                  <th className="py-3 pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {fees.installments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-brand-navy">{inst.label}</td>
                    <td className="py-3 pr-4">{formatIstDate(inst.dueDate)}</td>
                    <td className="py-3 pr-4 text-right font-mono">{formatMoney(inst.amountPaise)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-success">
                      {formatMoney(inst.paidPaise)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {formatMoney(inst.balancePaise)}
                    </td>
                    <td className="py-3 pr-2">
                      <Badge
                        tone={
                          inst.status === 'paid'
                            ? 'success'
                            : inst.status === 'overdue'
                              ? 'danger'
                              : 'warning'
                        }
                        dot
                      >
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

      {/* Receipts */}
      <Card>
        <CardHeader title="Receipts" subtitle="Downloadable PDFs for every payment" />
        {fees.receipts.length === 0 ? (
          <EmptyState title="No receipts yet" message="Your payment receipts will appear here." />
        ) : (
          <ul className="divide-y divide-black/5">
            {fees.receipts.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden
                    className="shrink-0 h-10 w-10 rounded-xl bg-navy-50 border border-navy-100 grid place-items-center text-brand-navy"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold font-mono text-brand-navy truncate">{r.code}</p>
                    <p className="text-xs text-muted">{formatIstDate(r.issuedAt)}</p>
                  </div>
                </div>
                <a
                  href={`/v1/receipts/${r.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-sm font-semibold text-brand-navy hover:text-brand-orange transition-colors"
                >
                  Download →
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
