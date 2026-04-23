import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExamAttemptDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { TextArea, Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { examsApi, facultyApi } from '../../lib/endpoints.js';

interface EssayGrade {
  questionIndex: number;
  score: number;
  comment: string;
}

export function FacultyGradingDetailPage() {
  const { attemptId = '' } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery<ExamAttemptDto>({
    queryKey: ['exam-attempt', attemptId],
    queryFn: () => facultyApi.examAttempt(attemptId),
    enabled: !!attemptId,
  });
  const examQ = useQuery({
    queryKey: ['exam-from-attempt', attemptId],
    queryFn: async () => {
      const a = await facultyApi.examAttempt(attemptId);
      return examsApi.get(a.examId);
    },
    enabled: !!q.data,
  });

  const [grades, setGrades] = useState<EssayGrade[]>([]);
  const submit = useMutation({
    mutationFn: () => examsApi.grade(attemptId, grades),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculty', 'grading'] });
      navigate('/faculty/grading');
    },
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const a = q.data;
  const exam = examQ.data;

  function setGrade(qi: number, patch: Partial<EssayGrade>) {
    setGrades((cur) => {
      const idx = cur.findIndex((g) => g.questionIndex === qi);
      const base: EssayGrade = idx >= 0 ? cur[idx]! : { questionIndex: qi, score: 0, comment: '' };
      const next: EssayGrade = { ...base, ...patch };
      if (idx >= 0) return cur.map((g, i) => (i === idx ? next : g));
      return [...cur, next];
    });
  }
  function gradeFor(qi: number): EssayGrade {
    return grades.find((g) => g.questionIndex === qi) ?? { questionIndex: qi, score: 0, comment: '' };
  }

  const essayQuestions = (exam?.questions ?? [])
    .map((q, qi) => ({ q, qi }))
    .filter(({ q }) => q.kind === 'essay');

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Grade attempt</h1>
        <p className="text-muted text-sm mt-1">
          Student {a.studentId.slice(-6)} · MCQ {a.mcqScorePercent ?? '—'}%
        </p>
      </div>
      {essayQuestions.length === 0 ? (
        <Card>
          <EmptyState title="No essay questions" message="This exam is auto-graded; no manual scoring needed." />
        </Card>
      ) : (
        essayQuestions.map(({ q, qi }) => {
          const ans = a.essayAnswers.find((e) => e.questionIndex === qi);
          const g = gradeFor(qi);
          return (
            <Card key={qi}>
              <CardHeader title={`Q${qi + 1}: ${q.text}`} subtitle={`Worth ${q.points} points`} />
              <div className="bg-brand-cream/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-w-[68ch]">
                {ans?.text || <span className="text-muted">No answer.</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <Input
                  label="Score"
                  type="number"
                  min={0}
                  max={q.points}
                  value={g.score}
                  onChange={(e) => setGrade(qi, { score: Number(e.target.value) })}
                />
                <div className="sm:col-span-2">
                  <TextArea
                    label="Comment"
                    rows={3}
                    value={g.comment}
                    onChange={(e) => setGrade(qi, { comment: e.target.value })}
                  />
                </div>
              </div>
            </Card>
          );
        })
      )}
      {essayQuestions.length > 0 && (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Submitting locks this grade and notifies the student.
          </p>
          <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={grades.length === 0}>
            Save grade
          </Button>
        </Card>
      )}
      {submit.isError && <ErrorAlert message={(submit.error as Error).message} />}
    </div>
  );
}
