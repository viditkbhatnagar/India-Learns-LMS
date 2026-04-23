import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExamAttemptDto, ExamDto } from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { examsApi } from '../../lib/endpoints.js';

interface MCQAnswers {
  [questionIndex: number]: number[];
}
interface EssayAnswers {
  [questionIndex: number]: string;
}

function useCountdown(deadline: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const ms = Math.max(0, deadline.getTime() - now.getTime());
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { ms, label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` };
}

export function ExamAttemptPage() {
  const { examId = '' } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [mcq, setMcq] = useState<MCQAnswers>({});
  const [essays, setEssays] = useState<EssayAnswers>({});
  const [submitted, setSubmitted] = useState<ExamAttemptDto | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.get(examId),
    enabled: !!examId,
  });

  const startMutation = useMutation({
    mutationFn: () => examsApi.startAttempt(examId),
    onSuccess: (a) => {
      setAttemptId(a.id);
      startedAtRef.current = new Date(a.startedAt);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!attemptId) throw new Error('No attempt');
      return examsApi.submitAttempt(attemptId, {
        answers: Object.entries(mcq).map(([k, v]) => ({
          questionIndex: Number(k),
          chosenIndices: v,
        })),
        essayAnswers: Object.entries(essays).map(([k, v]) => ({
          questionIndex: Number(k),
          text: v,
        })),
      });
    },
    onSuccess: (a) => {
      setSubmitted(a);
      qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
    },
  });

  const exam = examQuery.data as ExamDto | undefined;
  const examDuration = exam?.durationMinutes ?? null;
  const deadline = useMemo(() => {
    if (!examDuration || !startedAtRef.current) return null;
    return new Date(startedAtRef.current.getTime() + examDuration * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examDuration, attemptId]);
  const countdown = useCountdown(deadline);
  const ms = countdown?.ms ?? null;

  useEffect(() => {
    if (ms === null || !attemptId || submitted) return;
    if (ms <= 0) submitMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, attemptId, submitted]);

  if (examQuery.isLoading)
    return (
              <Skeleton lines={8} />
    );
  if (examQuery.isError || !exam)
    return (
              <ErrorAlert
          message={examQuery.error instanceof Error ? examQuery.error.message : 'Exam not found'}
          onRetry={() => examQuery.refetch()}
        />
    );

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-brand-gradient text-white shadow-elev-4 text-center">
          <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-brand-orange font-bold">
              Exam submitted
            </p>
            <h1 className="text-display-sm text-white mt-2">{exam.title}</h1>
            {submitted.totalScorePercent !== null && (
              <div
                aria-hidden
                className="mx-auto mt-6 h-28 w-28 rounded-full bg-white/10 border border-white/30 grid place-items-center shadow-elev-3"
              >
                <p className="text-display-md text-brand-orange font-mono tabular-nums count-up">
                  {submitted.totalScorePercent}%
                </p>
              </div>
            )}
            <p className="text-sm text-white/80 mt-5">
              MCQ: {submitted.mcqScorePercent ?? 'pending'}%
              {submitted.essayScorePercent !== null
                ? ` · Essay: ${submitted.essayScorePercent}%`
                : ' · Essay scoring is in your faculty\'s queue.'}
            </p>
            <Button className="mt-7" size="lg" onClick={() => navigate('/student/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <Card accent="orange">
          <p className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">
            Final exam
          </p>
          <h1 className="text-display-sm text-brand-navy">{exam.title}</h1>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2 text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
              {exam.questions.length} question{exam.questions.length === 1 ? '' : 's'} · pass at{' '}
              {exam.passingPercent}%
            </li>
            {exam.durationMinutes && (
              <li className="flex items-center gap-2 text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
                Duration: {exam.durationMinutes} minutes (auto-submit on timeout)
              </li>
            )}
            <li className="flex items-center gap-2 text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
              Up to {exam.maxAttempts} attempt{exam.maxAttempts === 1 ? '' : 's'} allowed
            </li>
            <li className="flex items-center gap-2 text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
              Essay answers are graded by your faculty after submission
            </li>
          </ul>
          <Button
            className="mt-7"
            size="lg"
            loading={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            Begin exam →
          </Button>
          {startMutation.isError && (
            <p className="mt-3 text-sm text-danger">
              {(startMutation.error as Error).message}
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <Card
        className={`sticky top-20 z-10 flex items-center justify-between p-4 ${
          countdown && countdown.ms < 60_000 ? 'shadow-elev-3 border-danger/30' : ''
        }`}
      >
        <div>
          <h1 className="text-lg font-semibold text-brand-navy tracking-tight">{exam.title}</h1>
          <p className="text-xs text-muted">Final exam · auto-saves on blur</p>
        </div>
        {countdown && (
          <div
            role="timer"
            aria-live="polite"
            className={`font-mono text-2xl font-bold tabular-nums ${
              countdown.ms < 60_000 ? 'text-danger animate-pulse-soft' : 'text-brand-navy'
            }`}
          >
            {countdown.label}
          </div>
        )}
      </Card>

      {exam.questions.map((q, qi) => {
        const isMcq = q.kind !== 'essay';
        if (isMcq) {
          const multi = q.kind === 'mcq_multi';
          return (
            <Card key={qi}>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">
                Question {qi + 1} of {exam.questions.length}
              </p>
              <p className="font-semibold text-brand-navy mt-2 text-lg leading-snug">{q.text}</p>
              <ul className="mt-4 space-y-2.5">
                {q.options.map((opt, oi) => {
                  const checked = (mcq[qi] ?? []).includes(oi);
                  const id = `q${qi}-o${oi}`;
                  return (
                    <li key={oi}>
                      <label
                        htmlFor={id}
                        className={`flex items-center gap-3 rounded-xl border-2 p-3.5 cursor-pointer transition-all ${
                          checked
                            ? 'border-brand-orange bg-orange-50 shadow-elev-1'
                            : 'border-black/10 hover:border-brand-orange/40 hover:bg-surface-muted'
                        }`}
                      >
                        <input
                          id={id}
                          type={multi ? 'checkbox' : 'radio'}
                          name={`mcq-${qi}`}
                          checked={checked}
                          onChange={() => {
                            setMcq((a) => {
                              const cur = a[qi] ?? [];
                              const next = multi
                                ? checked
                                  ? cur.filter((v) => v !== oi)
                                  : [...cur, oi]
                                : [oi];
                              return { ...a, [qi]: next };
                            });
                          }}
                          className="accent-brand-orange h-4 w-4"
                        />
                        <span className="text-sm text-ink">{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        }
        // Essay
        const essayId = `essay-${qi}`;
        const text = essays[qi] ?? '';
        const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
        const limit = q.wordLimit ?? 0;
        return (
          <Card key={qi}>
            <p className="text-xs uppercase tracking-widest text-muted font-bold">
              Question {qi + 1} of {exam.questions.length}
            </p>
            <label htmlFor={essayId} className="block font-semibold text-brand-navy mt-2 text-lg leading-snug">
              {q.text}
            </label>
            <textarea
              id={essayId}
              value={text}
              onChange={(e) => setEssays((a) => ({ ...a, [qi]: e.target.value }))}
              rows={8}
              className="mt-3 w-full rounded-xl border border-black/10 bg-white p-3.5 text-sm hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              placeholder="Write your answer…"
            />
            <p
              className={`text-xs mt-2 font-medium ${
                limit && wc > limit ? 'text-danger' : 'text-muted'
              }`}
            >
              {wc} word{wc === 1 ? '' : 's'}
              {limit ? ` of ${limit}` : ''}
            </p>
          </Card>
        );
      })}

      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
        <p className="text-sm text-muted flex-1">
          Once submitted, you'll see MCQ results immediately. Essay answers are graded by your faculty.
        </p>
        <Button
          size="lg"
          loading={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          Submit exam
        </Button>
      </Card>
      {submitMutation.isError && (
        <ErrorAlert message={(submitMutation.error as Error).message} />
      )}
    </div>
  );
}
