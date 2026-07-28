import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link } from 'react-router-dom';
import type { CourseDto, ProgramDto } from 'india-learns-shared-types';
import { programsApi, coursesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { ApiHttpError, apiErrorMessage } from '../../lib/api.js';
import { slugify } from '../../lib/slug.js';

export function AdminPrograms() {
  const readOnly = false; // superadmin now has full write access (round 3)
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState<string | null>(null);
  // Once the admin hand-edits the slug, stop auto-filling it from the name.
  const slugEdited = useRef(false);
  const create = useMutation({
    // Slugify on the way out too, so a stray space/capital can never bounce
    // as "Request failed validation" — the server normalizes it either way.
    mutationFn: () => programsApi.create({ name: name.trim(), slug: slugify(slug || name) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      setName('');
      setSlug('');
      slugEdited.current = false;
    },
    onError: (e) => setErr(apiErrorMessage(e, 'Could not create the program. Please try again.')),
  });

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited.current) setSlug(slugify(value));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Programs"
        subtitle={`${query.data?.length ?? 0} program${(query.data?.length ?? 0) === 1 ? '' : 's'}`}
      />

      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />
      )}
      {query.data && (
        <Card accent="navy">
          <CardHeader title="All programs" />
          {query.data.length === 0 ? (
            <EmptyState title="No programs yet" message="Create your first program below." />
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((p) => (
                <ProgramRow key={p.id} program={p} />
              ))}
            </ul>
          )}
        </Card>
      )}
      {!readOnly && (
        <Card accent="orange">
          <CardHeader
            title="Create program"
            subtitle="Just type the name — the slug fills in automatically."
          />
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setErr(null);
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                placeholder="Diploma in Fashion & Retail Management"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
              <Input
                label="Slug (auto-filled)"
                placeholder="diploma-in-fashion-retail-management"
                value={slug}
                onChange={(e) => {
                  slugEdited.current = true;
                  setSlug(e.target.value);
                }}
                onBlur={() => setSlug((s) => slugify(s))}
                hint="Auto-generated from the name. You can edit it — spaces and capitals are fixed for you."
              />
            </div>
            {err && (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm"
              >
                {err}
              </div>
            )}
            <Button type="submit" loading={create.isPending}>
              Create program
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

/** One program in the list, with a guarded delete. */
function ProgramRow({ program: p }: { program: ProgramDto }): JSX.Element {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: () => programsApi.remove(p.id),
    onSuccess: () => {
      setErr(null);
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['programs'] });
    },
    // The server refuses (409) while courses/batches/students are attached and
    // says exactly what — surface that verbatim, it is the actionable bit.
    onError: (e) => setErr(apiErrorMessage(e, 'Could not delete this program.')),
  });

  return (
    <li className="py-3 -mx-2 px-2 rounded-lg hover:bg-surface-muted/50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <Link to={`/admin/programs/${p.id}/admissions`} className="min-w-0 flex-1">
          <p className="font-semibold text-brand-navy truncate">{p.name}</p>
          <p className="text-xs text-muted font-mono mt-0.5">
            {p.slug} · {p.totalHours}h
          </p>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {p.admissionsEnabled && (
            <Badge tone="accent" dot>
              Admissions on
            </Badge>
          )}
          <Badge tone={p.isActive ? 'success' : 'neutral'} dot>
            {p.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="danger"
                loading={del.isPending}
                onClick={() => del.mutate()}
              >
                Confirm delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setConfirming(false); setErr(null); }}>
                Cancel
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setErr(null); setConfirming(true); }}
              className="text-xs text-danger hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {err && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {err}
        </p>
      )}
    </li>
  );
}

export function AdminCourses() {
  const query = useQuery({ queryKey: ['courses'], queryFn: coursesApi.list });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Courses"
        subtitle={`${query.data?.length ?? 0} course${(query.data?.length ?? 0) === 1 ? '' : 's'}`}
      />
      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />
      )}
      {query.data && (
        <Card accent="navy" className="p-0 overflow-hidden">
          {query.data.length === 0 ? (
            <div className="p-6"><EmptyState title="No courses yet" /></div>
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((c) => (
                <CourseRow key={c.id} course={c} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function CourseRow({ course }: { course: CourseDto }) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close the overflow menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDoc(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const del = useMutation({
    mutationFn: () => coursesApi.delete(course.id),
    onSuccess: () => {
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e) => setError(e instanceof ApiHttpError ? e.message : 'Delete failed.'),
  });

  // Sandbox courses are safe to delete; published ones need an unpublish
  // first per the API rule. Show Delete only for sandbox.
  const canDelete = course.state === 'sandbox';

  return (
    <li className="relative">
      <Link
        to={`/courses/${course.id}/overview`}
        className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted/70 transition-colors group"
      >
        <div className="min-w-0">
          <p className="font-semibold text-brand-navy truncate group-hover:text-brand-orange transition-colors">
            {course.name}
          </p>
          <p className="text-xs text-muted font-mono mt-0.5">
            {course.slug} · {course.state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={course.state === 'published' ? 'success' : 'warning'} dot>
            {course.state}
          </Badge>
          <button
            type="button"
            aria-label={`Actions for ${course.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="h-8 w-8 grid place-items-center rounded-md text-muted hover:bg-black/5 hover:text-brand-navy"
          >
            <span aria-hidden className="text-lg leading-none">⋯</span>
          </button>
        </div>
      </Link>
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-4 top-12 z-20 min-w-[160px] rounded-xl border border-black/10 bg-white shadow-lg p-1.5"
        >
          <Link
            to={`/courses/${course.id}/overview`}
            className="block px-3 py-1.5 text-sm rounded-md hover:bg-surface-muted text-brand-navy"
            onClick={() => setMenuOpen(false)}
          >
            Open
          </Link>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
            className={`block w-full text-left px-3 py-1.5 text-sm rounded-md ${
              canDelete
                ? 'text-danger hover:bg-red-50'
                : 'text-muted/60 cursor-not-allowed'
            }`}
            title={canDelete ? '' : 'Unpublish the course first to enable Delete.'}
          >
            Delete
          </button>
        </div>
      )}
      {confirmDelete && (
        <div className="px-5 pb-3">
          <div className="rounded-xl border border-danger/30 bg-red-50 p-3 text-sm text-danger flex items-center justify-between gap-3 flex-wrap">
            <span>Delete <strong>{course.name}</strong>? This cannot be undone.</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                loading={del.isPending}
                onClick={() => del.mutate()}
              >
                Confirm delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmDelete(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      )}
    </li>
  );
}
