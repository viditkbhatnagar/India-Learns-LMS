import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { feesApi } from '../../lib/endpoints.js';
import { formatIstDateTime, formatMoney } from '../../lib/format.js';

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
        <Row label="Amount" value={formatMoney(payment.amountPaise)} mono />
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
      <span className={mono ? 'font-mono tabular-nums text-xs' : ''}>{value}</span>
    </div>
  );
}
