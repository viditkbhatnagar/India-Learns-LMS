import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  JobApplicationDto,
  JobApplicationStatus,
  JobPostingDto,
} from 'india-learns-shared-types';
import { authApi, placementApi } from '../lib/endpoints.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input, TextArea } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../components/ui/States.js';
import { PageHeader } from '../components/ui/PageHeader.js';

// M10f — Student Jobs page (LMS_Requirements §3). Browse published
// postings filtered to the student's programme (server-enforced), apply
// with their profile resume + an optional cover note, and track the
// status of past applications.

const STATUS_TONES: Record<JobApplicationStatus, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'accent'> = {
  applied: 'info',
  shortlisted: 'accent',
  interview_scheduled: 'warning',
  selected: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export function StudentJobsPage() {
  const postingsQ = useQuery({
    queryKey: ['student', 'jobs'],
    queryFn: () => placementApi.listJobs(),
  });
  const appsQ = useQuery({
    queryKey: ['student', 'job-applications'],
    queryFn: () => placementApi.listMyApplications(),
  });
  const meQ = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => authApi.me(),
  });

  const [selected, setSelected] = useState<JobPostingDto | null>(null);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Placement"
        title="Jobs"
        subtitle="Openings shared with your programme. Apply with your profile resume; track every application here."
      />
      {meQ.data && !meQ.data.resumeUrl && (
        <Card>
          <p className="text-sm">
            You haven't uploaded a resume to your{' '}
            <Link to="/profile" className="text-brand-orange hover:underline">
              profile
            </Link>{' '}
            yet. You'll need one to apply.
          </p>
        </Card>
      )}

      {appsQ.data && appsQ.data.length > 0 && (
        <MyApplications applications={appsQ.data} />
      )}

      <Card>
        <CardHeader
          title="Open positions"
          subtitle={`${postingsQ.data?.length ?? 0} opening${
            postingsQ.data?.length === 1 ? '' : 's'
          } for your programme.`}
        />
        {postingsQ.isLoading && <Skeleton lines={4} />}
        {postingsQ.isError && (
          <ErrorAlert
            message={(postingsQ.error as Error).message}
            onRetry={() => postingsQ.refetch()}
          />
        )}
        {postingsQ.data && postingsQ.data.length === 0 && (
          <EmptyState
            title="No openings yet"
            message="Check back soon — the placement team posts new opportunities regularly."
          />
        )}
        {postingsQ.data && postingsQ.data.length > 0 && (
          <ul className="divide-y divide-black/5">
            {postingsQ.data.map((p) => (
              <li
                key={p.id}
                className="py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-brand-navy truncate">{p.title}</p>
                  <p className="text-sm text-muted mt-0.5">
                    {p.companyName ?? '—'} · {p.location || 'Remote'} ·{' '}
                    <span className="capitalize">
                      {p.employmentType.replace('_', ' ')}
                    </span>
                  </p>
                  {p.applicationDeadline && (
                    <p className="text-xs text-warning mt-1">
                      Apply by{' '}
                      {new Date(p.applicationDeadline).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <Button onClick={() => setSelected(p)}>View details</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && (
        <PostingDetail
          posting={selected}
          existingApplication={
            appsQ.data?.find((a) => a.jobPostingId === selected.id) ?? null
          }
          canApply={Boolean(meQ.data?.resumeUrl)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function MyApplications({ applications }: { applications: JobApplicationDto[] }) {
  const qc = useQueryClient();
  const withdraw = useMutation({
    mutationFn: (id: string) => placementApi.withdrawApplication(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['student', 'job-applications'] }),
  });
  return (
    <Card>
      <CardHeader
        title="My applications"
        subtitle={`${applications.length} active or past`}
      />
      <ul className="divide-y divide-black/5">
        {applications.map((a) => (
          <li key={a.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-navy">
                Application · {a.coverNote ? a.coverNote.slice(0, 60) : '(no note)'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Applied {new Date(a.appliedAt).toLocaleDateString('en-IN')}
                {a.interviewNote && ` · ${a.interviewNote}`}
              </p>
              {/* M10l — Show structured interview schedule when set. */}
              {a.status === 'interview_scheduled' && a.interviewAt && (
                <p className="text-xs text-warning mt-1 font-medium">
                  Interview:{' '}
                  {new Date(a.interviewAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {a.interviewLocation && ` · ${a.interviewLocation}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={STATUS_TONES[a.status]} dot>
                {a.status.replace('_', ' ')}
              </Badge>
              {a.status !== 'withdrawn' && a.status !== 'selected' && a.status !== 'rejected' && (
                <Button onClick={() => withdraw.mutate(a.id)}>Withdraw</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PostingDetail({
  posting,
  existingApplication,
  canApply,
  onClose,
}: {
  posting: JobPostingDto;
  existingApplication: JobApplicationDto | null;
  canApply: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [coverNote, setCoverNote] = useState('');
  const [resumeOverride, setResumeOverride] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () =>
      placementApi.applyToJob(posting.id, {
        coverNote,
        resumeUrl: resumeOverride || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'job-applications'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to apply.'),
  });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-brand-navy">{posting.title}</h3>
          <p className="text-sm text-muted">
            {posting.companyName ?? '—'} · {posting.location || 'Remote'} ·{' '}
            <span className="capitalize">
              {posting.employmentType.replace('_', ' ')}
            </span>
          </p>
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>
      <p className="text-sm whitespace-pre-wrap text-ink/80">{posting.description}</p>
      {posting.eligibility && (
        <div className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted font-bold mb-1">
            Eligibility
          </p>
          <p>{posting.eligibility}</p>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-black/5">
        {existingApplication ? (
          <p className="text-sm">
            You applied on{' '}
            {new Date(existingApplication.appliedAt).toLocaleDateString('en-IN')}.{' '}
            Status:{' '}
            <Badge tone={STATUS_TONES[existingApplication.status]} dot size="sm">
              {existingApplication.status.replace('_', ' ')}
            </Badge>
          </p>
        ) : !canApply ? (
          <p className="text-sm text-warning">
            Upload a resume on your{' '}
            <Link to="/profile" className="underline">
              profile
            </Link>{' '}
            to apply.
          </p>
        ) : (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setError(null);
              apply.mutate();
            }}
            className="space-y-3"
          >
            <TextArea
              label="Cover note (optional)"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              rows={3}
              placeholder="Why are you a good fit?"
            />
            <Input
              label="Resume URL (override your profile resume)"
              value={resumeOverride}
              onChange={(e) => setResumeOverride(e.target.value)}
              placeholder="Leave blank to use profile resume"
            />
            {error && (
              <div role="alert" className="rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger">
                {error}
              </div>
            )}
            <Button type="submit" loading={apply.isPending}>
              Apply
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
