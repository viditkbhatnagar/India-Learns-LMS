import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { programsApi, coursesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Programs</h1>
      {query.isLoading && <Skeleton lines={5} />}
      {query.isError && <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && (
        <Card>
          {query.data.length === 0 ? (
            <EmptyState title="No programs yet" />
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-navy">{p.name}</p>
                    <p className="text-xs text-muted mono">{p.slug} · {p.totalHours}h</p>
                  </div>
                  <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {!readOnly && (
        <Card>
          <CardHeader title="Create program" />
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setErr(null);
              create.mutate();
            }}
            className="space-y-3"
          >
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required hint="Lowercase, hyphens only" />
            {err && <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">{err}</div>}
            <Button type="submit" loading={create.isPending}>Create</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

export function AdminCourses() {
  const query = useQuery({ queryKey: ['courses'], queryFn: coursesApi.list });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Courses</h1>
      {query.isLoading && <Skeleton lines={5} />}
      {query.isError && <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && (
        <Card>
          {query.data.length === 0 ? (
            <EmptyState title="No courses yet" />
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-navy">{c.name}</p>
                    <p className="text-xs text-muted mono">{c.slug} · {c.state}</p>
                  </div>
                  <Badge tone={c.state === 'published' ? 'success' : 'warning'}>{c.state}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
