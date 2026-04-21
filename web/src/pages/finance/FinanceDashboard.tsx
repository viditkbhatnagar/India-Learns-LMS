import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton, ErrorAlert } from '../../components/ui/States.js';
import { formatMoney } from '../../lib/format.js';

export function FinanceDashboard() {
  // Finance is not authorised for /v1/analytics/summary in M8 (admin/superadmin
  // only). Placeholder finance-scoped aggregates land in M9 polish.
  const query = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: analyticsApi.summary,
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">Finance dashboard</h1>
        <Link to="/finance/payments/new">
          <Button>Record a payment</Button>
        </Link>
      </div>
      <p className="text-muted text-sm">
        Scoped finance widgets (collections, outstanding balances, overdue queue) ship with M9.
        Record a payment or open a student&apos;s fees page to get started.
      </p>
      {query.isLoading && <Skeleton lines={5} />}
      {query.isError && (
        <Card>
          <CardHeader title="Collections (admin view)" subtitle="Requires admin access. Ask admin for the scoped finance dashboard coming in M9." />
          <ErrorAlert message={(query.error as Error).message} />
        </Card>
      )}
      {query.data && (
        <Card>
          <CardHeader title="Collections snapshot" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">This month</dt>
              <dd className="text-xl font-semibold text-brand-navy">{formatMoney(query.data.fees.collectedThisMonthPaise)}</dd>
            </div>
            <div>
              <dt className="text-muted">Year to date</dt>
              <dd className="text-xl font-semibold text-brand-navy">{formatMoney(query.data.fees.collectedYtdPaise)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Outstanding balance</dt>
              <dd className="text-xl font-semibold text-danger">{formatMoney(query.data.fees.outstandingPaise)}</dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}
