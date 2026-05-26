import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { adminEnrollmentsApi, enrollmentsApi } from '../../lib/endpoints.js';
import { formatIstDate, formatIstDateTime } from '../../lib/format.js';

export function AdminEnrollmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsApi.get(id),
    enabled: !!id,
  });
  const issue = useMutation({
    mutationFn: (opts: { force?: boolean } = {}) => enrollmentsApi.issueCertificate(id, opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment', id] }),
  });
  const generateFees = useMutation({
    mutationFn: () => adminEnrollmentsApi.generateFees(id),
  });
  // Q-M8-02 — guard the destructive reissue path behind a confirmation
  // step so an admin can't accidentally invalidate a live certificate URL
  // by clicking the button twice.
  const [confirmReissue, setConfirmReissue] = useState(false);
  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} />;
  if (!q.data) return null;
  const e = q.data;
  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/admin/enrollments" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <h1 className="text-display-sm text-brand-navy tracking-tight">Enrolment {e.id.slice(-8)}</h1>
      <Card className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Student" value={e.studentId} />
        <Row label="Course" value={e.courseId} />
        <Row label="Status" value={e.status} />
        <Row label="Access" value={e.accessState} />
        <Row label="Completed" value={e.completed ? 'Yes' : 'No'} />
        <Row label="Valid to" value={formatIstDate(e.validTo)} />
      </Card>
      <Card>
        <CardHeader title="Certificate" />
        {e.certificateUrl ? (
          <p className="text-sm">
            Issued{' '}
            {e.certificateIssuedAt && formatIstDateTime(e.certificateIssuedAt)} ·{' '}
            <a className="text-brand-orange hover:underline" href={e.certificateUrl} target="_blank" rel="noreferrer">
              View certificate
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted">No certificate yet.</p>
        )}
        {!e.certificateUrl && (
          <Button
            className="mt-3"
            loading={issue.isPending}
            onClick={() => issue.mutate({})}
            disabled={!e.completed}
          >
            Issue certificate
          </Button>
        )}
        {e.certificateUrl && !confirmReissue && (
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => setConfirmReissue(true)}
            disabled={!e.completed}
          >
            Force reissue (new certificate)
          </Button>
        )}
        {e.certificateUrl && confirmReissue && (
          <div className="mt-3 p-3 rounded-xl border border-warning/30 bg-warning/5 space-y-2">
            <p className="text-sm text-brand-navy">
              This calls Certifier with a fresh idempotency key and overwrites the existing
              certificate URL. The student will receive a new download link. Continue?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={issue.isPending}
                onClick={() => {
                  issue.mutate(
                    { force: true },
                    { onSettled: () => setConfirmReissue(false) },
                  );
                }}
              >
                Yes, reissue
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmReissue(false)}
                disabled={issue.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {!e.completed && (
          <p className="text-xs text-muted mt-2">
            Enrolment must be completed (course done + exam passed) before a certificate can be issued.
          </p>
        )}
        {issue.isError && <ErrorAlert message={(issue.error as Error).message} />}
      </Card>
      <Card>
        <CardHeader title="Fees" />
        <Button variant="secondary" loading={generateFees.isPending} onClick={() => generateFees.mutate()}>
          Generate / refresh invoices
        </Button>
        {generateFees.isError && <ErrorAlert message={(generateFees.error as Error).message} />}
        {generateFees.data && (
          <p className="text-sm mt-2 text-success">
            {generateFees.data.length} invoice{generateFees.data.length === 1 ? '' : 's'} ready.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className="text-brand-navy font-medium">{value}</p>
    </div>
  );
}
