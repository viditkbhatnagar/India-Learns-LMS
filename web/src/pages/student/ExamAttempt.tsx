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
              <Card className="max-w-2xl mx-auto p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold">
            Exam submitted
          </p>
          <h1 className="text-3xl font-bold text-brand-navy mt-2">{exam.title}</h1>
          <p className="text-sm text-muted mt-3">
            MCQ score: {submitted.mcqScorePercent ?? 'pending'}%
            {submitted.essayScorePercent !== null
              ? ` · Essay score: ${submitted.essayScorePercent}%`
              : ' · Essay scoring is in your faculty\'s queue.'}
          </p>
          {submitted.totalScorePercent !== null && (
            <p className="text-5xl font-extrabold mt-4 text-brand-navy">
              {submitted.totalScorePercent}%
            </p>
          )}
          <Button className="mt-6" onClick={() => navigate('/student/dashboard')}>
            Back to dashboard
          </Button>
        </Card>
    );
  }

  if (!attemptId) {
    return (
              <Card className="max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-bold text-brand-navy">{exam.title}</h1>
          <ul className="mt-4 text-sm text-muted space-y-1">
            <li>{exam.questions.length} questions · pass at {exam.passingPercent}%</li>
            {exam.durationMinutes && <li>Duration: {exam.durationMinutes} minutes (auto-submit)</li>}
            <li>Up to {exam.maxAttempts} attempts allowed</li>
            <li>Essay answers are graded by your faculty after submission.</li>
          </ul>
          <Button
            className="mt-6"
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
    );
  }

  return (
          <div className="max-w-3xl mx-auto space-y-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-brand-navy">{exam.title}</h1>
            <p className="text-xs text-muted">Final exam · auto-saves on blur</p>
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

        {exam.questions.map((q, qi) => {
          const isMcq = q.kind !== 'essay';
          if (isMcq) {
            const multi = q.kind === 'mcq_multi';
            return (
              <Card key={qi} className="p-5">
                <p className="text-xs text-muted">Question {qi + 1} of {exam.questions.length}</p>
                <p className="font-medium text-brand-navy mt-1">{q.text}</p>
                <ul className="mt-4 space-y-2">
                  {q.options.map((opt, oi) => {
                    const checked = (mcq[qi] ?? []).includes(oi);
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
          }
          // Essay
          const essayId = `essay-${qi}`;
          const text = essays[qi] ?? '';
          const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
          const limit = q.wordLimit ?? 0;
          return (
            <Card key={qi} className="p-5">
              <p className="text-xs text-muted">Question {qi + 1} of {exam.questions.length}</p>
              <label htmlFor={essayId} className="block font-medium text-brand-navy mt-1">
                {q.text}
              </label>
              <textarea
                id={essayId}
                value={text}
                onChange={(e) => setEssays((a) => ({ ...a, [qi]: e.target.value }))}
                rows={8}
                className="mt-3 w-full rounded-lg border border-black/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
                placeholder="Write your answer…"
              />
              <p className={`text-xs mt-2 ${limit && wc > limit ? 'text-danger' : 'text-muted'}`}>
                {wc} word{wc === 1 ? '' : 's'}
                {limit ? ` of ${limit}` : ''}
              </p>
            </Card>
          );
        })}

        <Card className="p-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            Once submitted, you'll see MCQ results immediately. Essay answers
            are graded by your faculty.
          </p>
          <Button
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
