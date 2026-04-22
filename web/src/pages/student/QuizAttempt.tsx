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
              <Card className="max-w-2xl mx-auto p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold">
            Quiz complete
          </p>
          <h1 className="text-3xl font-bold text-brand-navy mt-2">{quiz.title}</h1>
          <p className="text-5xl font-extrabold mt-4 text-brand-navy">
            {submitted.scorePercent ?? 0}%
          </p>
          <p
            className={`mt-2 font-semibold ${submitted.passed ? 'text-success' : 'text-warning'}`}
          >
            {submitted.passed ? 'You passed.' : `Below ${quiz.passingPercent}% — try again later.`}
          </p>
          <Button className="mt-6" onClick={() => navigate('/student/courses')}>
            Back to courses
          </Button>
        </Card>
    );
  }

  if (!attemptId) {
    return (
              <Card className="max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-bold text-brand-navy">{quiz.title}</h1>
          <ul className="mt-4 text-sm text-muted space-y-1">
            <li>{quiz.questions.length} questions · pass at {quiz.passingPercent}%</li>
            {quiz.durationMinutes && <li>Duration: {quiz.durationMinutes} minutes (auto-submit)</li>}
            <li>Up to {quiz.maxAttempts} attempts allowed</li>
          </ul>
          <Button
            className="mt-6"
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
    );
  }

  return (
          <div className="max-w-3xl mx-auto space-y-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-brand-navy">{quiz.title}</h1>
            <p className="text-xs text-muted">
              {Object.keys(answers).length}/{quiz.questions.length} answered
            </p>
          </div>
          {countdown && (
            <div
              role="timer"
              aria-live="polite"
              className={`font-mono text-xl font-bold ${countdown.ms < 60_000 ? 'text-danger' : 'text-brand-navy'}`}
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
            <Card key={qi} className="p-5">
              <p className="text-xs text-muted">Question {qi + 1} of {quiz.questions.length}</p>
              <p className="font-medium text-brand-navy mt-1">{q.text}</p>
              <ul className="mt-4 space-y-2">
                {q.options.map((opt, oi) => {
                  const checked = (answers[qi] ?? []).includes(oi);
                  const id = `q${qi}-o${oi}`;
                  return (
                    <li key={oi}>
                      <label
                        htmlFor={id}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${checked ? 'border-brand-orange bg-brand-orange/5' : 'border-black/10 hover:border-brand-orange/40'}`}
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
                          className="accent-brand-orange"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}

        <Card className="p-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            Submitting locks your answers — make sure you've reviewed everything.
          </p>
          <Button
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
