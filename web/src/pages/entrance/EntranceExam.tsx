import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EntranceAttemptSelfDto,
  EntranceExamPublicDto,
  SaveEntranceAnswerInput,
} from 'india-learns-shared-types';
import { useEntranceAuthStore } from '../../store/entranceAuth.js';
import { entranceApi } from '../../lib/entranceApi.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';

interface LocalAnswer {
  selectedIndex: number | null;
  textAnswer: string;
}
type AnswerMap = Record<number, LocalAnswer>;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 700;

function useCountdown(deadline: Date | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline || !active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, active]);
  if (!deadline) return null;
  const ms = Math.max(0, deadline.getTime() - now);
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { ms, label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` };
}

function buildPayload(map: AnswerMap): SaveEntranceAnswerInput[] {
  return Object.entries(map).map(([k, v]) => ({
    questionIndex: Number(k),
    selectedIndex: v.selectedIndex,
    textAnswer: v.textAnswer,
  }));
}

export function EntranceExamPage() {
  const token = useEntranceAuthStore((s) => s.token);
  const clear = useEntranceAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const stateQuery = useQuery({
    queryKey: ['entrance', 'state'],
    queryFn: entranceApi.getState,
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const [attempt, setAttempt] = useState<EntranceAttemptSelfDto | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const answersRef = useRef<AnswerMap>({});
  const saveTimer = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const submittingRef = useRef(false);

  const exam = stateQuery.data?.exam as EntranceExamPublicDto | undefined;

  // Hydrate the local attempt + answer map from the server once.
  useEffect(() => {
    const server = stateQuery.data?.attempt;
    if (!server || hydratedRef.current) return;
    hydratedRef.current = true;
    setAttempt(server);
    const map: AnswerMap = {};
    server.answers.forEach((a) => {
      map[a.questionIndex] = { selectedIndex: a.selectedIndex, textAnswer: a.textAnswer };
    });
    setAnswers(map);
    answersRef.current = map;
  }, [stateQuery.data]);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      setSaveState('saving');
      await entranceApi.saveAnswers(buildPayload(answersRef.current));
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      flushSave().catch(() => {});
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const updateAnswer = useCallback(
    (qi: number, patch: Partial<LocalAnswer>) => {
      setAnswers((prev) => {
        const next: AnswerMap = {
          ...prev,
          [qi]: { selectedIndex: null, textAnswer: '', ...prev[qi], ...patch },
        };
        answersRef.current = next;
        return next;
      });
      setSaveState('saving');
      scheduleSave();
    },
    [scheduleSave],
  );

  const startMutation = useMutation({
    mutationFn: () => entranceApi.startAttempt(),
    onSuccess: (a) => {
      setAttempt(a);
      hydratedRef.current = true;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (auto: boolean) => {
      submittingRef.current = true;
      return entranceApi.submit({ answers: buildPayload(answersRef.current), auto });
    },
    onSuccess: (a) => {
      setAttempt(a);
      qc.setQueryData(['entrance', 'state'], (prev: unknown) =>
        prev && typeof prev === 'object' ? { ...(prev as object), attempt: a } : prev,
      );
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const isActive = attempt?.status === 'in_progress';
  const deadline = useMemo(
    () => (attempt ? new Date(attempt.deadlineAt) : null),
    [attempt],
  );
  const countdown = useCountdown(deadline, Boolean(isActive));
  const ms = countdown?.ms ?? null;

  // Auto-submit once the timer hits zero.
  useEffect(() => {
    if (ms === null || !isActive || submittingRef.current) return;
    if (ms <= 0) submitMutation.mutate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, isActive]);

  if (!token) return <Navigate to="/entrance" replace />;

  if (stateQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Skeleton lines={8} />
      </div>
    );
  }
  if (stateQuery.isError || !exam) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <ErrorAlert
          message={
            stateQuery.error instanceof Error
              ? stateQuery.error.message
              : 'Could not load the entrance exam.'
          }
          onRetry={() => stateQuery.refetch()}
        />
      </div>
    );
  }

  // Submitted / graded — confirmation only, never a score.
  if (attempt && attempt.status !== 'in_progress') {
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-surface-muted">
        <div className="max-w-lg w-full text-center animate-fade-in-up">
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-brand-gradient text-white shadow-elev-4">
            <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
            <div className="relative">
              <p className="text-xs uppercase tracking-widest text-brand-orange font-bold">
                Response received
              </p>
              <h1 className="text-display-sm text-white mt-3">Thank you!</h1>
              <p className="text-sm text-white/85 mt-4">
                Your entrance exam has been submitted successfully. All your
                answers have been recorded. You may now close this window.
              </p>
              <Button
                className="mt-7"
                size="lg"
                onClick={() => {
                  clear();
                  navigate('/entrance', { replace: true });
                }}
              >
                Finish
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Briefing — not started yet.
  if (!attempt) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-surface-muted">
        <div className="max-w-2xl w-full animate-fade-in-up">
          <Card accent="orange">
            <p className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">
              Entrance examination
            </p>
            <h1 className="text-display-sm text-brand-navy">{exam.title}</h1>
            {exam.instructions && (
              <p className="mt-3 text-sm text-ink/80 leading-relaxed">{exam.instructions}</p>
            )}
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
                {exam.questions.length} questions · {exam.totalMarks} marks
              </li>
              <li className="flex items-center gap-2 text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
                Duration: {exam.durationMinutes} minutes (auto-submits when time is up)
              </li>
              <li className="flex items-center gap-2 text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
                Your answers save automatically as you go
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
      </div>
    );
  }

  // Active attempt.
  return (
    <div className="min-h-dvh bg-surface-muted pb-16">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Card
          className={`sticky top-4 z-10 flex items-center justify-between p-4 ${
            countdown && countdown.ms < 60_000 ? 'shadow-elev-3 border-danger/30' : ''
          }`}
        >
          <div>
            <h1 className="text-lg font-semibold text-brand-navy tracking-tight">{exam.title}</h1>
            <p className="text-xs text-muted">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && 'All answers saved'}
              {saveState === 'error' && (
                <span className="text-danger">Couldn’t save — check your connection</span>
              )}
              {saveState === 'idle' && 'Answers save automatically'}
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

        {exam.questions.map((q) => {
          const qi = q.index;
          const current = answers[qi];
          if (q.kind === 'text') {
            const text = current?.textAnswer ?? '';
            return (
              <Card key={qi}>
                <p className="text-xs uppercase tracking-widest text-muted font-bold">
                  {q.section} · Question {qi + 1} of {exam.questions.length}
                </p>
                <label
                  htmlFor={`q-${qi}`}
                  className="block font-semibold text-brand-navy mt-2 text-lg leading-snug"
                >
                  {q.text}
                </label>
                <textarea
                  id={`q-${qi}`}
                  value={text}
                  onChange={(e) => updateAnswer(qi, { textAnswer: e.target.value })}
                  onBlur={() => {
                    flushSave().catch(() => {});
                  }}
                  rows={6}
                  className="mt-3 w-full rounded-xl border border-black/10 bg-white p-3.5 text-sm hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                  placeholder="Write your answer…"
                />
              </Card>
            );
          }
          const selected = current?.selectedIndex ?? null;
          return (
            <Card key={qi}>
              <p className="text-xs uppercase tracking-widest text-muted font-bold">
                {q.section} · Question {qi + 1} of {exam.questions.length}
              </p>
              <p className="font-semibold text-brand-navy mt-2 text-lg leading-snug">{q.text}</p>
              <ul className="mt-4 space-y-2.5">
                {q.options.map((opt, oi) => {
                  const checked = selected === oi;
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
                          type="radio"
                          name={`q-${qi}`}
                          checked={checked}
                          onChange={() => updateAnswer(qi, { selectedIndex: oi })}
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
            When you’re done, submit your exam. You won’t be able to change your
            answers afterwards.
          </p>
          <Button
            size="lg"
            loading={submitMutation.isPending}
            onClick={() => {
              if (window.confirm('Submit your entrance exam? You cannot change answers after this.')) {
                submitMutation.mutate(false);
              }
            }}
          >
            Submit exam
          </Button>
        </Card>
        {submitMutation.isError && (
          <ErrorAlert message={(submitMutation.error as Error).message} />
        )}
      </div>
    </div>
  );
}
