import { useQuery } from '@tanstack/react-query';
import { certificatesApi } from '../../lib/endpoints.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

export function StudentCertificates() {
  const query = useQuery({ queryKey: ['me', 'certificates'], queryFn: certificatesApi.listMine });
  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const items = query.data ?? [];

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Achievements
        </p>
        <h1 className="text-display-sm text-brand-navy">Certificates</h1>
        <p className="mt-2 text-muted">
          Verifiable credentials for the courses you've completed.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No certificates yet"
            message="Complete a course (all quizzes passed + final exam passed) and your certificate will appear here."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden>
                <circle cx="12" cy="10" r="6" />
                <path d="M8 14v7l4-3 4 3v-7" />
              </svg>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in-up">
          {items.map((c) => (
            <Card key={c.enrollmentId} className="overflow-hidden p-0">
              {/* Certificate header — decorative medallion band. */}
              <div className="relative h-32 bg-brand-gradient flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-hero-radial opacity-70" />
                <div
                  aria-hidden
                  className="relative h-20 w-20 rounded-full bg-white/10 border border-white/30 backdrop-blur-sm grid place-items-center shadow-elev-3"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-brand-orange">
                    <circle cx="12" cy="10" r="6" />
                    <path d="M8 14v7l4-3 4 3v-7" />
                  </svg>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-muted font-bold">
                      Course certificate
                    </p>
                    <p className="font-semibold text-brand-navy text-lg mt-1 truncate tracking-tight">
                      {c.courseName}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {c.issuedAt ? `Issued ${formatIstDate(c.issuedAt)}` : 'Awaiting issue'}
                    </p>
                  </div>
                  {c.certificateUrl ? (
                    <Badge tone="success" dot>
                      Issued
                    </Badge>
                  ) : c.issueError ? (
                    <Badge tone="danger" dot>
                      Failed
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      Pending
                    </Badge>
                  )}
                </div>
                {c.certificateUrl ? (
                  <a href={c.certificateUrl} target="_blank" rel="noreferrer">
                    <Button className="w-full">View / download</Button>
                  </a>
                ) : (
                  <p className="text-sm text-muted leading-relaxed">
                    {c.issueError ?? 'Your certificate is queued. Admin has been notified and it will be retried automatically.'}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
