import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedbackEntryDto } from 'india-learns-shared-types';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { facultyApi, feedbackApi } from '../../lib/endpoints.js';

export function FacultyFeedbackPage() {
  const q = useQuery({ queryKey: ['faculty', 'feedback'], queryFn: facultyApi.listFeedback });
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">Feedback</h1>
          <p className="text-muted text-sm mt-1">
            Drafts and published responses. Students see only published items.
          </p>
        </div>
        <Link to="/faculty/feedback/new">
          <Button>New feedback</Button>
        </Link>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              message="Use New feedback to write your first rubric + summary."
              action={
                <Link to="/faculty/feedback/new">
                  <Button>Write feedback</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((f) => (
                <FeedbackRow key={f.id} f={f} />
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

function FeedbackRow({ f }: { f: FeedbackEntryDto }) {
  const qc = useQueryClient();
  const publish = useMutation({
    mutationFn: () => feedbackApi.publish(f.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty', 'feedback'] }),
  });
  return (
    <li className="py-3 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-brand-navy">
          {f.level} · student {f.studentId.slice(-6)}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {f.summary?.slice(0, 90) || 'No summary'}…
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={f.status === 'published' ? 'success' : 'warning'}>{f.status}</Badge>
        {f.status === 'draft' && (
          <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate()}>
            Publish
          </Button>
        )}
      </div>
    </li>
  );
}
