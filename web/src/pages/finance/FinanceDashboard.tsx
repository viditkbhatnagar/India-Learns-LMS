import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { useAuthStore } from '../../store/auth.js';
import { formatMoney } from '../../lib/format.js';

export function FinanceDashboard() {
  // Finance is not authorised for /v1/analytics/summary in M8 (admin/superadmin
  // only). Scoped finance widgets land in M9 polish.
  const me = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsApi.summary(),
    retry: false,
  });

  const hourIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const greeting =
    Number(hourIst) < 12 ? 'Good morning' : Number(hourIst) < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-brand-gradient text-white shadow-elev-3">
        <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm tracking-wide uppercase">
              {greeting} · Finance
            </p>
            <h1 className="text-display-md mt-1 text-white">
              {me?.name.split(' ')[0] ?? 'Finance'}
              <span className="text-brand-orange">.</span>
            </h1>
            <p className="mt-3 text-white/80 max-w-xl">
              Record payments, issue receipts, and keep collections on schedule.
            </p>
          </div>
          <Link to="/finance/payments/new">
            <Button size="lg" className="shadow-elev-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Record payment
            </Button>
          </Link>
        </div>
      </section>

      <PageHeader
        title="Quick view"
        subtitle="Scoped finance widgets ship with M9. Admin view below (if you have access)."
      />

      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <Card>
          <CardHeader
            title="Collections snapshot"
            subtitle="Admin-only endpoint. Finance-scoped aggregates are coming in M9."
          />
          <div className="rounded-xl border border-navy-100 bg-navy-50/60 p-6 text-center">
            <p className="text-sm text-brand-navy font-medium">
              Use{' '}
              <Link to="/finance/payments/new" className="underline hover:text-brand-orange">
                Record payment
              </Link>{' '}
              or{' '}
              <Link to="/finance/payments" className="underline hover:text-brand-orange">
                Payments
              </Link>{' '}
              to get started.
            </p>
          </div>
        </Card>
      )}
      {query.data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricTile
            label="Collected this month"
            value={formatMoney(query.data.fees.collectedThisMonthPaise)}
            tone="navy"
          />
          <MetricTile
            label="Collected YTD"
            value={formatMoney(query.data.fees.collectedYtdPaise)}
            tone="navy"
          />
          <MetricTile
            label="Outstanding balance"
            value={formatMoney(query.data.fees.outstandingPaise)}
            tone="orange"
          />
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'navy' | 'orange';
}) {
  const numberTone = tone === 'orange' ? 'text-brand-orange' : 'text-brand-navy';
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-elev-1 p-5">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`mt-2 text-2xl font-bold font-mono tabular-nums count-up ${numberTone}`}>
        {value}
      </p>
    </div>
  );
}
