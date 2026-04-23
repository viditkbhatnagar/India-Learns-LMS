import { useQuery } from '@tanstack/react-query';
import { feedbackApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

export function StudentFeedback() {
  const query = useQuery({ queryKey: ['me', 'feedback'], queryFn: feedbackApi.listMine });
  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const items = query.data ?? [];

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Growth
        </p>
        <h1 className="text-display-sm text-brand-navy">Feedback</h1>
        <p className="mt-2 text-muted">
          Rubric scores, written comments, and summary notes from your faculty.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No feedback yet"
            message="Faculty will share rubric scores, written feedback and summary notes here."
          />
        </Card>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {items.map((f) => (
            <Card key={f.id} accent={f.status === 'published' ? 'orange' : 'none'}>
              <CardHeader
                title={`${f.level.charAt(0).toUpperCase()}${f.level.slice(1)} feedback`}
                subtitle={
                  f.publishedAt
                    ? `Published ${formatIstDate(f.publishedAt)}`
                    : 'Draft (not yet published)'
                }
                action={
                  <Badge tone={f.status === 'published' ? 'success' : 'neutral'} dot>
                    {f.status}
                  </Badge>
                }
              />
              {f.summary && (
                <div className="rounded-xl bg-navy-50 border border-navy-100 p-4 text-ink leading-relaxed mb-4 max-w-[68ch]">
                  {f.summary}
                </div>
              )}
              {f.comments && (
                <div className="rounded-xl bg-surface-muted p-4 text-sm whitespace-pre-wrap text-ink/90 leading-relaxed max-w-[68ch]">
                  {f.comments}
                </div>
              )}
              {f.scores.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                    Rubric
                  </p>
                  <ul className="divide-y divide-black/5 border border-black/5 rounded-xl overflow-hidden">
                    {f.scores.map((s) => (
                      <li
                        key={s.criterionIndex}
                        className="flex items-center justify-between p-3 bg-white"
                      >
                        <span className="text-sm text-muted">Criterion {s.criterionIndex + 1}</span>
                        <span className="font-semibold font-mono text-brand-navy">
                          {s.score !== null ? s.score : '—'}
                          {s.label ? (
                            <span className="text-muted font-normal"> · {s.label}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
