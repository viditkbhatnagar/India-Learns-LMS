import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { TextArea, Input } from '../../components/ui/Input.js';
import { ErrorAlert } from '../../components/ui/States.js';
import { facultyApi, feedbackApi, usersApi } from '../../lib/endpoints.js';

export function FacultyFeedbackNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [level, setLevel] = useState<'course' | 'module' | 'assignment' | 'assessment'>('module');
  const [summary, setSummary] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentsQ = useQuery({
    queryKey: ['users', 'students-for-feedback'],
    queryFn: () => usersApi.list({ role: 'student' }),
  });
  const coursesQ = useQuery({ queryKey: ['faculty', 'courses'], queryFn: facultyApi.myCourses });

  const create = useMutation({
    mutationFn: () =>
      feedbackApi.create({
        studentId,
        courseId,
        moduleId: moduleId || null,
        level,
        summary,
        comments,
        status: 'draft',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculty', 'feedback'] });
      navigate('/faculty/feedback');
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId) return setError('Pick a student.');
    if (!courseId) return setError('Pick a course.');
    if (summary.length < 10) return setError('Summary must be at least 10 characters.');
    create.mutate();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-display-sm text-brand-navy tracking-tight">New feedback</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Student</span>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(studentsQ.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Course</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(coursesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Level</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="course">Course</option>
              <option value="module">Module</option>
              <option value="assignment">Assignment</option>
              <option value="assessment">Assessment</option>
            </select>
          </label>
          {level === 'module' && (
            <Input
              label="Module ID (optional)"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              hint="Leave empty for course-level feedback."
            />
          )}
          <TextArea
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            required
          />
          <TextArea
            label="Detailed feedback"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={6}
          />
          {error && <ErrorAlert message={error} />}
          {create.isError && <ErrorAlert message={(create.error as Error).message} />}
          <div className="flex justify-end">
            <Button type="submit" loading={create.isPending}>Save draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
