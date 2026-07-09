import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EntranceAttemptAnswerAdminDto,
  EntranceAttemptAdminDto,
} from 'india-learns-shared-types';
import { entranceAdminApi } from '../../lib/endpoints.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';

function fmtIST(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium text-brand-navy">{value}</p>
    </div>
  );
}

function TextGrader({
  attemptId,
  candidateId,
  answer,
}: {
  attemptId: string;
  candidateId: string;
  answer: EntranceAttemptAnswerAdminDto;
}) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState<string>(
    answer.awardedMarks !== null ? String(answer.awardedMarks) : '',
  );
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      entranceAdminApi.gradeText(attemptId, {
        questionIndex: answer.questionIndex,
        marks: Number(marks),
        comment: comment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entrance-admin', 'candidate', candidateId] });
      qc.invalidateQueries({ queryKey: ['entrance-admin', 'candidates'] });
    },
  });

  const inputCls =
    'rounded-xl border border-black/10 bg-white p-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all';
  const marksNum = Number(marks);
  const invalid = marks === '' || Number.isNaN(marksNum) || marksNum < 0 || marksNum > answer.points;

  return (
    <div className="mt-4 rounded-xl border border-brand-orange/30 bg-orange-50/60 p-4">
      <p className="text-xs uppercase tracking-wider text-brand-orange font-bold">
        Score this written answer
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-ink/70 mb-1">
            Marks (0–{answer.points})
          </span>
          <input
            type="number"
            min={0}
            max={answer.points}
            step="0.5"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className={`${inputCls} w-28`}
          />
        </label>
        <label className="text-sm flex-1 min-w-[200px]">
          <span className="block text-xs font-semibold text-ink/70 mb-1">Comment (optional)</span>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Note for the record…"
            className={`${inputCls} w-full`}
          />
        </label>
        <Button
          loading={mutation.isPending}
          disabled={invalid}
          onClick={() => mutation.mutate()}
        >
          Save score
        </Button>
      </div>
      {mutation.isError && (
        <p className="mt-2 text-sm text-danger">{(mutation.error as Error).message}</p>
      )}
      {mutation.isSuccess && <p className="mt-2 text-sm text-success">Score saved.</p>}
    </div>
  );
}

function AnswerRow({
  answer,
  attempt,
  candidateId,
}: {
  answer: EntranceAttemptAnswerAdminDto;
  attempt: EntranceAttemptAdminDto;
  candidateId: string;
}) {
  const graded = attempt.status !== 'in_progress';
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-bold">
            {answer.section} · Q{answer.questionIndex + 1}
          </p>
          <p className="font-semibold text-brand-navy mt-1 leading-snug">{answer.questionText}</p>
        </div>
        {answer.kind === 'mcq' && graded && (
          <Badge tone={answer.isCorrect ? 'success' : 'danger'}>
            {answer.isCorrect ? `+${answer.points}` : '0'}
          </Badge>
        )}
      </div>

      {answer.kind === 'mcq' ? (
        <ul className="mt-3 space-y-2">
          {answer.options.map((opt, oi) => {
            const isSelected = answer.selectedIndex === oi;
            const isCorrect = answer.correctIndex === oi;
            return (
              <li
                key={oi}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${
                  isCorrect
                    ? 'border-success/50 bg-emerald-50'
                    : isSelected
                      ? 'border-danger/50 bg-red-50'
                      : 'border-black/10'
                }`}
              >
                <span className="flex-1">{opt}</span>
                {isSelected && (
                  <span className="text-xs font-semibold text-ink/70">chosen</span>
                )}
                {isCorrect && (
                  <span className="text-xs font-semibold text-success">correct answer</span>
                )}
              </li>
            );
          })}
          {answer.selectedIndex === null && (
            <li className="text-sm text-muted italic">No answer selected.</li>
          )}
        </ul>
      ) : (
        <div className="mt-3">
          <div className="rounded-xl border border-black/10 bg-surface-muted p-3.5 text-sm whitespace-pre-wrap min-h-[3rem]">
            {answer.textAnswer ? (
              answer.textAnswer
            ) : (
              <span className="text-muted italic">No written answer.</span>
            )}
          </div>
          {graded ? (
            <TextGrader attemptId={attempt.id} candidateId={candidateId} answer={answer} />
          ) : (
            <p className="mt-2 text-xs text-muted">
              Grading opens once the candidate submits.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminEntranceAttemptPage() {
  const { candidateId = '' } = useParams<{ candidateId: string }>();
  const query = useQuery({
    queryKey: ['entrance-admin', 'candidate', candidateId],
    queryFn: () => entranceAdminApi.getCandidate(candidateId),
    enabled: !!candidateId,
  });

  if (query.isLoading) return <Skeleton lines={10} />;
  if (query.isError) {
    return (
      <ErrorAlert
        message={query.error instanceof Error ? query.error.message : 'Failed to load.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const { candidate, attempt } = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entrance exam"
        title={candidate.name}
        subtitle={candidate.phone}
        back={{ to: '/admin/entrance', label: 'Back to entrance exam' }}
      />

      {!attempt ? (
        <EmptyState
          title="Not started"
          message="This candidate has not begun the exam yet."
        />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge
                  tone={
                    attempt.status === 'graded'
                      ? 'success'
                      : attempt.status === 'submitted'
                        ? 'warning'
                        : 'info'
                  }
                >
                  {attempt.status.replace('_', ' ')}
                </Badge>
                {attempt.autoSubmitted && <Badge tone="neutral">auto-submitted</Badge>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-brand-navy tabular-nums">
                  {attempt.totalScoreMarks !== null
                    ? `${attempt.totalScoreMarks}/${attempt.totalMarks}`
                    : '—'}
                </p>
                <p className="text-xs text-muted">
                  Auto {attempt.autoScoreMarks}
                  {attempt.manualScoreMarks !== null
                    ? ` · Written ${attempt.manualScoreMarks}`
                    : ' · Written pending'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <Meta label="Started" value={fmtIST(attempt.startedAt)} />
              <Meta label="Submitted" value={fmtIST(attempt.submittedAt)} />
              <Meta label="Graded" value={fmtIST(attempt.gradedAt)} />
              <Meta label="IP address" value={attempt.ip || '—'} />
            </div>
          </Card>

          <div className="space-y-4">
            {attempt.answers.map((a) => (
              <AnswerRow
                key={a.questionIndex}
                answer={a}
                attempt={attempt}
                candidateId={candidateId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
