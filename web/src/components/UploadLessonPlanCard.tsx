import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CourseDto } from 'india-learns-shared-types';
import { Card, CardHeader } from './ui/Card.js';
import { Button } from './ui/Button.js';
import { Input } from './ui/Input.js';
import { ErrorAlert, Skeleton } from './ui/States.js';
import { coursesApi, curriculumImportApi, programsApi } from '../lib/endpoints.js';
import { apiErrorMessage } from '../lib/api.js';

const SELECT_CLS =
  'w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all';

/**
 * Self-serve: upload a finalized lesson-plan Word file and create a new course
 * or replace an existing course's lessons from it. The document is the source
 * of truth (no generator involved).
 */
export function UploadLessonPlanCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<
    { suggestedName: string; moduleCount: number; lessonCount: number; modules: { title: string; lessons: number }[] } | null
  >(null);
  const [programId, setProgramId] = useState('');
  const [mode, setMode] = useState<'create' | 'replace'>('create');
  const [name, setName] = useState('');
  const [replaceCourseId, setReplaceCourseId] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: boolean; modules: number; lessons: number; courseId: string } | null>(null);

  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const coursesQ = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list() as Promise<CourseDto[]>,
    enabled: mode === 'replace',
  });
  const coursesForProgram = (coursesQ.data ?? []).filter((c) => c.programId === programId);

  const parseMut = useMutation({
    mutationFn: (f: File) => curriculumImportApi.parseFile(f),
    onSuccess: (data) => {
      setPreview(data);
      setName(data.suggestedName);
      setError(null);
      setResult(null);
    },
    onError: (e) => {
      setPreview(null);
      setError(apiErrorMessage(e, 'Could not read that file — please upload a .docx.'));
    },
  });
  const ingestMut = useMutation({
    mutationFn: () =>
      curriculumImportApi.ingestFile(file!, {
        programId,
        name: name.trim(),
        courseId: mode === 'replace' ? replaceCourseId : undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Import failed.')),
  });

  function onFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setConfirmText('');
    if (f) parseMut.mutate(f);
  }

  return (
    <Card accent="orange">
      <CardHeader
        title="Upload a finalized lesson plan (Word)"
        subtitle="Use your edited .docx as the source — it creates a new course or replaces an existing course's lessons."
      />
      <div className="space-y-4">
        <input
          type="file"
          accept=".docx"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-navy file:px-3 file:py-2 file:text-white hover:file:bg-brand-navy/90"
        />
        {parseMut.isPending && <Skeleton lines={1} />}

        {preview && (
          <>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-brand-navy">
              ✓ Read <strong>{preview.moduleCount}</strong> modules and <strong>{preview.lessonCount}</strong> lessons from the file.
            </div>
            <label className="block">
              <span className="block text-sm font-semibold text-brand-navy mb-1.5">Target program</span>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={SELECT_CLS}>
                <option value="">— Select a program —</option>
                {(programsQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} className="accent-brand-orange" />
                Create a new course
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-brand-orange" />
                Replace an existing course
              </label>
            </div>
            {mode === 'create' ? (
              <Input label="New course name" value={name} onChange={(e) => setName(e.target.value)} />
            ) : (
              <label className="block">
                <span className="block text-sm font-semibold text-brand-navy mb-1.5">Course to replace</span>
                <select
                  value={replaceCourseId}
                  onChange={(e) => { setReplaceCourseId(e.target.value); setConfirmText(''); }}
                  className={SELECT_CLS}
                  disabled={!programId}
                >
                  <option value="">{programId ? '— Select a course —' : 'Pick a program first'}</option>
                  {coursesForProgram.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.state === 'published' ? ' — PUBLISHED (live)' : ' — draft'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              {mode === 'replace'
                ? "Replacing removes that course's current modules and lessons and rebuilds them from this file. Courses that already have enrolled students, submissions or attendance are protected — the server will refuse."
                : 'A new draft (sandbox) course is created under the selected program.'}
            </div>
            {mode === 'replace' && replaceCourseId && (
              <label className="block">
                <span className="block text-sm font-semibold text-brand-navy mb-1.5">
                  Type the course name to confirm
                </span>
                <Input
                  label=""
                  placeholder={coursesForProgram.find((c) => c.id === replaceCourseId)?.name ?? ''}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </label>
            )}
            <Button
              loading={ingestMut.isPending}
              onClick={() => {
                setError(null);
                if (!programId) return setError('Pick a target program.');
                if (mode === 'create' && !name.trim()) return setError('Enter a course name.');
                if (mode === 'replace') {
                  if (!replaceCourseId) return setError('Pick a course to replace.');
                  const target = coursesForProgram.find((c) => c.id === replaceCourseId);
                  if (confirmText.trim() !== (target?.name ?? '').trim()) {
                    return setError('Type the exact course name to confirm the replace.');
                  }
                }
                return ingestMut.mutate();
              }}
            >
              {mode === 'replace' ? 'Replace lessons' : 'Create course'} — {preview.lessonCount} lessons
            </Button>
          </>
        )}

        {error && <ErrorAlert message={error} />}
        {result && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-brand-navy">
            ✓ {result.created ? 'Created' : 'Replaced'} — {result.modules} modules, {result.lessons} lessons.{' '}
            <Link to={`/courses/${result.courseId}/overview`} className="text-brand-orange hover:underline font-medium">
              Open course →
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
