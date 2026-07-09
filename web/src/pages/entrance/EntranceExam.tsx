import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

function answersFrom(attempt: EntranceAttemptSelfDto): AnswerMap {
  const map: AnswerMap = {};
  attempt.answers.forEach((a) => {
    map[a.questionIndex] = { selectedIndex: a.selectedIndex, textAnswer: a.textAnswer };
  });
  return map;
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center p-6 bg-surface-muted">
      <div className="max-w-2xl w-full animate-fade-in-up">{children}</div>
    </div>
  );
}

export function EntranceExamPage() {
  const token = useEntranceAuthStore((s) => s.token);
  const clear = useEntranceAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Key scoped by token so a second candidate on a shared/kiosk device never
  // reads the previous candidate's cached attempt + answers.
  const stateQuery = useQuery({
    queryKey: ['entrance', 'state', token],
    queryFn: entranceApi.getState,
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const finishSession = useCallback(() => {
    qc.removeQueries({ queryKey: ['entrance'] });
    clear();
    navigate('/entrance', { replace: true });
  }, [qc, clear, navigate]);

  const [attempt, setAttempt] = useState<EntranceAttemptSelfDto | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [justSubmitted, setJustSubmitted] = useState<number | null>(null);
  const answersRef = useRef<AnswerMap>({});
  const saveTimer = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const submittingRef = useRef(false);

  const exam = stateQuery.data?.exam as EntranceExamPublicDto | undefined;
  const attemptsUsed = stateQuery.data?.attemptsUsed ?? 0;
  const maxAttempts = stateQuery.data?.maxAttempts ?? exam?.maxAttempts ?? 1;

  // Initialize from the server ONCE (resume an in-progress attempt if present).
  // After this, start/submit mutations drive `attempt` locally so a background
  // refetch can't clobber a freshly-started attempt.
  useEffect(() => {
    if (initializedRef.current || !stateQuery.data) return;
    initializedRef.current = true;
    const server = stateQuery.data.attempt;
    if (server) {
      setAttempt(server);
      const map = answersFrom(server);
      setAnswers(map);
      answersRef.current = map;
    }
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

  const cancelPendingSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const startMutation = useMutation({
    mutationFn: () => entranceApi.startAttempt(),
    onSuccess: (a) => {
      // Drop any queued autosave from the previous attempt before swapping in a
      // fresh (empty) answer set — otherwise it could PATCH stale answers.
      cancelPendingSave();
      setJustSubmitted(null);
      setAttempt(a);
      const map = answersFrom(a);
      setAnswers(map);
      answersRef.current = map;
      setSaveState('idle');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (auto: boolean) => {
      submittingRef.current = true;
      cancelPendingSave();
      return entranceApi.submit({ answers: buildPayload(answersRef.current), auto });
    },
    onSuccess: (a) => {
      setJustSubmitted(a.attemptNumber);
      setAttempt(null);
      // Refresh attemptsUsed for the "X of N" confirmation + retake gate.
      stateQuery.refetch().catch(() => {});
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const isActive = justSubmitted === null && attempt?.status === 'in_progress';
  const deadline = useMemo(
    () => (attempt && isActive ? new Date(attempt.deadlineAt) : null),
    [attempt, isActive],
  );
  const countdown = useCountdown(deadline, Boolean(isActive));

  // Auto-submit when time is up, retrying every few seconds if a submit fails
  // (e.g. a network blip) until it succeeds — which ends the attempt and clears
  // this interval via the isActive dependency.
  useEffect(() => {
    if (!isActive || !deadline) return undefined;
    const id = window.setInterval(() => {
      if (Date.now() >= deadline.getTime() && !submittingRef.current) {
        submitMutation.mutate(true);
      }
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, deadline]);

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

  // Just-submitted confirmation (never a score).
  if (justSubmitted !== null) {
    const used = Math.max(attemptsUsed, justSubmitted);
    const remaining = Math.max(0, maxAttempts - used);
    return (
      <CenteredCard>
        <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-brand-gradient text-white shadow-elev-4 text-center">
          <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-brand-orange font-bold">
              Attempt {justSubmitted} received
            </p>
            <h1 className="text-display-sm text-white mt-3">Thank you!</h1>
            <p className="text-sm text-white/85 mt-4">
              Your answers have been recorded. You have used{' '}
              <span className="font-semibold">{used}</span> of{' '}
              <span className="font-semibold">{maxAttempts}</span> attempts.
            </p>
            {remaining > 0 ? (
              <>
                <p className="text-sm text-white/85 mt-2">
                  You may retake the exam {remaining} more time{remaining === 1 ? '' : 's'}.
                </p>
                <Button
                  className="mt-6"
                  size="lg"
                  loading={startMutation.isPending}
                  onClick={() => startMutation.mutate()}
                >
                  Start attempt {used + 1} →
                </Button>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={finishSession}
                    className="text-sm text-white/80 underline hover:text-white"
                  >
                    I&rsquo;m done — finish
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/85 mt-2">
                  You have used all your attempts. You may now close this window.
                </p>
                <Button className="mt-6" size="lg" onClick={finishSession}>
                  Finish
                </Button>
              </>
            )}
            {startMutation.isError && (
              <p className="mt-3 text-sm text-white">
                {(startMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </CenteredCard>
    );
  }

  // Active attempt.
  if (isActive && attempt) {
    return (
      <div className="min-h-dvh bg-surface-muted pb-16">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <Card
            className={`sticky top-4 z-10 flex items-center justify-between p-4 ${
              countdown && countdown.ms < 60_000 ? 'shadow-elev-3 border-danger/30' : ''
            }`}
          >
            <div>
              <h1 className="text-lg font-semibold text-brand-navy tracking-tight">
                {exam.title}
              </h1>
              <p className="text-xs text-muted">
                Attempt {attempt.attemptNumber} of {maxAttempts} ·{' '}
                {saveState === 'saving' && 'Saving…'}
                {saveState === 'saved' && 'All answers saved'}
                {saveState === 'error' && (
                  <span className="text-danger">Couldn&rsquo;t save — check your connection</span>
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
              You may skip any question. When you&rsquo;re done, submit your exam — you
              can&rsquo;t change this attempt&rsquo;s answers afterwards.
            </p>
            <Button
              size="lg"
              loading={submitMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Submit this attempt? You cannot change these answers after submitting.',
                  )
                ) {
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

  // No attempts left.
  if (attemptsUsed >= maxAttempts) {
    return (
      <CenteredCard>
        <Card accent="orange">
          <p className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">
            Entrance examination
          </p>
          <h1 className="text-display-sm text-brand-navy">{exam.title}</h1>
          <p className="mt-4 text-sm text-ink/80">
            You have used all {maxAttempts} of your attempts for this exam. Thank you
            for participating.
          </p>
          <Button className="mt-6" variant="secondary" onClick={finishSession}>
            Sign out
          </Button>
        </Card>
      </CenteredCard>
    );
  }

  // Briefing (start a fresh attempt).
  return (
    <CenteredCard>
      <Card accent="orange">
        <p className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">
          Entrance examination · Attempt {attemptsUsed + 1} of {maxAttempts}
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
            You may skip any question · answers save automatically
          </li>
          <li className="flex items-center gap-2 text-ink/80">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden />
            Up to {maxAttempts} attempts allowed
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
          <p className="mt-3 text-sm text-danger">{(startMutation.error as Error).message}</p>
        )}
      </Card>
    </CenteredCard>
  );
}
