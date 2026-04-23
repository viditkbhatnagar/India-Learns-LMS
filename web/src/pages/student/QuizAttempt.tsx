import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuizAttemptDto, QuizDto } from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { ErrorAlert, Skeleton, EmptyState } from '../../components/ui/States.js';
import { quizzesApi } from '../../lib/endpoints.js';

interface AnswerMap {
  [questionIndex: number]: number[];
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

export function QuizAttemptPage() {
  const { quizId = '' } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState<QuizAttemptDto | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  const quizQuery = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => quizzesApi.get(quizId),
    enabled: !!quizId,
  });

  const startMutation = useMutation({
    mutationFn: () => quizzesApi.startAttempt(quizId),
    onSuccess: (a) => {
      setAttemptId(a.id);
      startedAtRef.current = new Date(a.startedAt);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!attemptId) throw new Error('No attempt');
      const payload = Object.entries(answers).map(([k, v]) => ({
        questionIndex: Number(k),
        chosenIndices: v,
      }));
      return quizzesApi.submitAttempt(attemptId, payload);
    },
    onSuccess: (a) => {
      setSubmitted(a);
      qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
    },
  });

  const quiz = quizQuery.data as QuizDto | undefined;
  const quizDuration = quiz?.durationMinutes ?? null;
  const deadline = useMemo(() => {
    if (!quizDuration || !startedAtRef.current) return null;
    return new Date(startedAtRef.current.getTime() + quizDuration * 60_000);
    // attemptId is the trigger to recompute when a new attempt starts (and
    // startedAtRef is freshly set); React Hook deps lint can't see refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizDuration, attemptId]);
  const countdown = useCountdown(deadline);
  const ms = countdown?.ms ?? null;

  // Auto-submit when timer hits zero. submitMutation is intentionally excluded
  // from deps — its identity changes every render but we only want to fire on
  // ms change.
  useEffect(() => {
    if (ms === null || !attemptId || submitted) return;
    if (ms <= 0) submitMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, attemptId, submitted]);

  if (quizQuery.isLoading)
    return (
              <Skeleton lines={8} />
    );
  if (quizQuery.isError || !quiz)
    return (
              <ErrorAlert
          message={quizQuery.error instanceof Error ? quizQuery.error.message : 'Quiz not found'}
          onRetry={() => quizQuery.refetch()}
        />
    );

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-brand-gradient text-white shadow-elev-4 text-center">
          <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-brand-orange font-bold">
              Quiz complete
            </p>
            <h1 className="text-display-sm text-white mt-2">{quiz.title}</h1>
            <div
              aria-hidden
              className="mx-auto mt-6 h-28 w-28 rounded-full bg-white/10 border border-white/30 grid place-items-center shadow-elev-3"
            >
              <p className="text-display-md text-brand-orange font-mono tabular-nums count-up">
                {submitted.scorePercent ?? 0}%
              </p>
            </div>
            <p className={`mt-5 font-bold text-lg ${submitted.passed ? 'text-emerald-300' : 'text-amber-300'}`}>
              {submitted.passed ? 'You passed 🎉' : `Below ${quiz.passingPercent}% — try again later.`}
            </p>
            <Button className="mt-7" size="lg" onClick={() => navigate('/student/courses')}>
              Back to courses
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
            Assessment
          </p>
          <h1 className="text-display-sm text-brand-navy">{quiz.title}</h1>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2 text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
              {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · pass at{' '}
              {quiz.passingPercent}%
            </li>
            {quiz.durationMinutes && (
              <li className="flex items-center gap-2 text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
                Duration: {quiz.durationMinutes} minutes (auto-submit on timeout)
              </li>
            )}
            <li className="flex items-center gap-2 text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
              Up to {quiz.maxAttempts} attempt{quiz.maxAttempts === 1 ? '' : 's'} allowed
            </li>
          </ul>
          <Button
            className="mt-7"
            size="lg"
            loading={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            Begin attempt →
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
          <h1 className="text-lg font-semibold text-brand-navy tracking-tight">{quiz.title}</h1>
          <p className="text-xs text-muted">
            {Object.keys(answers).length}/{quiz.questions.length} answered
          </p>
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

      {quiz.questions.length === 0 && (
        <Card>
          <EmptyState title="No questions" message="Contact your faculty." />
        </Card>
      )}

      {quiz.questions.map((q, qi) => {
        const multi = q.kind === 'mcq_multi';
        return (
          <Card key={qi}>
            <p className="text-xs uppercase tracking-widest text-muted font-bold">
              Question {qi + 1} of {quiz.questions.length}
            </p>
            <p className="font-semibold text-brand-navy mt-2 text-lg leading-snug">{q.text}</p>
            <ul className="mt-4 space-y-2.5">
              {q.options.map((opt, oi) => {
                const checked = (answers[qi] ?? []).includes(oi);
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
                        name={`q${qi}`}
                        checked={checked}
                        onChange={() => {
                          setAnswers((a) => {
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
      })}

      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
        <p className="text-sm text-muted flex-1">
          Submitting locks your answers — make sure you've reviewed everything.
        </p>
        <Button
          size="lg"
          loading={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          Submit attempt
        </Button>
      </Card>
      {submitMutation.isError && (
        <ErrorAlert message={(submitMutation.error as Error).message} />
      )}
    </div>
  );
}
