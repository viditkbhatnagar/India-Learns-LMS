import { useEffect, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GlossaryEntryDto, ReadingItemDto } from 'india-learns-shared-types';
import { coursesApi } from '../../../lib/endpoints.js';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input, TextArea } from '../../../components/ui/Input.js';
import { RequestErrorState, Skeleton, EmptyState } from '../../../components/ui/States.js';
import { ApiHttpError } from '../../../lib/api.js';
import { useCourseOversight } from '../../../contexts/CourseOversightContext.js';

// Faculty/admin editors for the course-level Glossary + Reading list
// (Logan request). Both edit the whole list and save it via
// coursesApi.update; read-only in oversight mode. Students see these
// lists on their course page.

export function CourseGlossaryTab({ courseId }: { courseId: string }): JSX.Element {
  const qc = useQueryClient();
  const { isOversight } = useCourseOversight();
  const courseQ = useQuery({
    queryKey: ['course', courseId, 'shell'],
    queryFn: () => coursesApi.get(courseId),
  });

  const [rows, setRows] = useState<GlossaryEntryDto[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (courseQ.data) setRows(courseQ.data.course.glossary ?? []);
  }, [courseQ.data]);

  const save = useMutation({
    mutationFn: () =>
      coursesApi.update(courseId, {
        glossary: rows
          .map((r) => ({ term: r.term.trim(), definition: r.definition.trim() }))
          .filter((r) => r.term && r.definition),
      }),
    onSuccess: () => {
      setErr(null);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ['course', courseId, 'shell'] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Save failed.'),
  });

  if (courseQ.isLoading) return <Skeleton variant="card" />;
  if (courseQ.isError || !courseQ.data) {
    return <RequestErrorState error={courseQ.error} onRetry={() => courseQ.refetch()} />;
  }

  return (
    <Card>
      <CardHeader
        title="Glossary"
        subtitle={
          isOversight
            ? 'Read-only — add yourself to this course to edit.'
            : 'Define key terms for this course. Students see this on their course page.'
        }
      />
      {rows.length === 0 && isOversight ? (
        <EmptyState title="No glossary terms yet" />
      ) : (
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <Input
                aria-label="Term"
                placeholder="Term"
                value={row.term}
                disabled={isOversight}
                onChange={(e) =>
                  setRows((rs) => rs.map((r, j) => (j === i ? { ...r, term: e.target.value } : r)))
                }
              />
              <TextArea
                aria-label="Definition"
                placeholder="Definition"
                rows={2}
                value={row.definition}
                disabled={isOversight}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, j) => (j === i ? { ...r, definition: e.target.value } : r)),
                  )
                }
              />
              {!isOversight && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-red-50"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!isOversight && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRows((rs) => [...rs, { term: '', definition: '' }])}
          >
            + Add term
          </Button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            Save glossary
          </Button>
          {savedAt && !save.isPending && !err && (
            <span className="text-xs text-success">Saved.</span>
          )}
          {err && <span className="text-xs text-danger">{err}</span>}
        </div>
      )}
    </Card>
  );
}

export function CourseReadingListTab({ courseId }: { courseId: string }): JSX.Element {
  const qc = useQueryClient();
  const { isOversight } = useCourseOversight();
  const courseQ = useQuery({
    queryKey: ['course', courseId, 'shell'],
    queryFn: () => coursesApi.get(courseId),
  });

  const [rows, setRows] = useState<ReadingItemDto[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (courseQ.data) setRows(courseQ.data.course.readingList ?? []);
  }, [courseQ.data]);

  const save = useMutation({
    mutationFn: () =>
      coursesApi.update(courseId, {
        readingList: rows
          .map((r) => ({
            title: r.title.trim(),
            author: r.author.trim(),
            url: r.url.trim(),
            note: r.note.trim(),
          }))
          .filter((r) => r.title),
      }),
    onSuccess: () => {
      setErr(null);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ['course', courseId, 'shell'] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Save failed.'),
  });

  if (courseQ.isLoading) return <Skeleton variant="card" />;
  if (courseQ.isError || !courseQ.data) {
    return <RequestErrorState error={courseQ.error} onRetry={() => courseQ.refetch()} />;
  }

  function patchRow(i: number, key: keyof ReadingItemDto, value: string): void {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }

  return (
    <Card>
      <CardHeader
        title="Reading list"
        subtitle={
          isOversight
            ? 'Read-only — add yourself to this course to edit.'
            : 'Books, articles, and links for this course. Students see this on their course page.'
        }
      />
      {rows.length === 0 && isOversight ? (
        <EmptyState title="No readings yet" />
      ) : (
        <ul className="space-y-4">
          {rows.map((row, i) => (
            <li key={i} className="rounded-xl border border-black/5 bg-white p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  aria-label="Title"
                  placeholder="Title (required)"
                  value={row.title}
                  disabled={isOversight}
                  onChange={(e) => patchRow(i, 'title', e.target.value)}
                />
                <Input
                  aria-label="Author"
                  placeholder="Author (optional)"
                  value={row.author}
                  disabled={isOversight}
                  onChange={(e) => patchRow(i, 'author', e.target.value)}
                />
              </div>
              <Input
                aria-label="Link"
                type="url"
                placeholder="https://… (optional)"
                value={row.url}
                disabled={isOversight}
                onChange={(e) => patchRow(i, 'url', e.target.value)}
              />
              <Input
                aria-label="Note"
                placeholder="Note, e.g. chapters 1–3 (optional)"
                value={row.note}
                disabled={isOversight}
                onChange={(e) => patchRow(i, 'note', e.target.value)}
              />
              {!isOversight && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-red-50"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!isOversight && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setRows((rs) => [...rs, { title: '', author: '', url: '', note: '' }])
            }
          >
            + Add reading
          </Button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            Save reading list
          </Button>
          {savedAt && !save.isPending && !err && (
            <span className="text-xs text-success">Saved.</span>
          )}
          {err && <span className="text-xs text-danger">{err}</span>}
        </div>
      )}
    </Card>
  );
}
