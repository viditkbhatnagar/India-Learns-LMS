import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { feesApi } from '../../lib/endpoints.js';

export function AdminFeeStructuresPage() {
  const q = useQuery({ queryKey: ['admin', 'fee-structures'], queryFn: feesApi.feeStructures });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Fee structures</h1>
        <p className="text-muted text-sm mt-1">
          Templates that drive invoice generation per program. Read-only browser; create via API.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState
              title="No fee structures yet"
              message="Use POST /v1/fee-structures to create one (TRD §4.6)."
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {(q.data as Array<Record<string, unknown>>).map((s) => (
                <li key={String(s.id)} className="py-3">
                  <p className="font-medium text-brand-navy">{String(s.name)}</p>
                  <p className="text-xs text-muted">
                    program {String(s.programId)} · {(s.components as unknown[])?.length ?? 0} components
                  </p>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
