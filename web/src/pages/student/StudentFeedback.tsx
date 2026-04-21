import { useQuery } from '@tanstack/react-query';
import { feedbackApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

export function StudentFeedback() {
  const query = useQuery({ queryKey: ['me', 'feedback'], queryFn: feedbackApi.listMine });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Feedback from faculty</h1>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No feedback yet"
            message="Faculty will share rubric scores, written feedback and summary notes here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.id}>
              <CardHeader
                title={`${f.level} feedback`}
                subtitle={f.publishedAt ? `Published ${formatIstDate(f.publishedAt)}` : 'Draft'}
                action={<Badge tone={f.status === 'published' ? 'success' : 'neutral'}>{f.status}</Badge>}
              />
              {f.summary && <p className="text-ink mb-2">{f.summary}</p>}
              {f.comments && (
                <div className="bg-brand-cream/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {f.comments}
                </div>
              )}
              {f.scores.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {f.scores.map((s) => (
                    <li key={s.criterionIndex} className="flex items-center justify-between">
                      <span className="text-muted">Criterion {s.criterionIndex + 1}</span>
                      <span className="font-semibold mono">
                        {s.score !== null ? s.score : '—'}
                        {s.label ? ` · ${s.label}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
