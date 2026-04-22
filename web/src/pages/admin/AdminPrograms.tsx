import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { programsApi, coursesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { useAuthStore } from '../../store/auth.js';
import { ApiHttpError } from '../../lib/api.js';

export function AdminPrograms() {
  const me = useAuthStore((s) => s.user);
  const readOnly = me?.role === 'superadmin';
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => programsApi.create({ name, slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      setName('');
      setSlug('');
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Failed'),
  });

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
                <li
                  key={p.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-surface-muted/50 transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy truncate">{p.name}</p>
                    <p className="text-xs text-muted font-mono mt-0.5">
                      {p.slug} · {p.totalHours}h
                    </p>
                  </div>
                  <Badge tone={p.isActive ? 'success' : 'neutral'} dot>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {!readOnly && (
        <Card accent="orange">
          <CardHeader
            title="Create program"
            subtitle="Slug is the URL-friendly identifier (lowercase, hyphens)"
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
                placeholder="Aviation Diploma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Slug"
                placeholder="aviation-diploma"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                hint="Lowercase, hyphens only"
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
        <Card accent="navy">
          {query.data.length === 0 ? (
            <EmptyState title="No courses yet" />
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((c) => (
                <li
                  key={c.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-surface-muted/50 transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy truncate">{c.name}</p>
                    <p className="text-xs text-muted font-mono mt-0.5">
                      {c.slug} · {c.state}
                    </p>
                  </div>
                  <Badge tone={c.state === 'published' ? 'success' : 'warning'} dot>
                    {c.state}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
