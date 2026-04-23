import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { Role } from 'india-learns-shared-types';
import { usersApi, programsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { ApiHttpError } from '../../lib/api.js';
import { useAuthStore } from '../../store/auth.js';

export function AdminUsers() {
  const me = useAuthStore((s) => s.user);
  const isReadOnly = me?.role === 'superadmin';
  const [role, setRole] = useState<Role | 'all'>('all');
  const [programId, setProgramId] = useState<string>('all');
  const [q, setQ] = useState('');
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const query = useQuery({
    queryKey: ['users', role, programId, q],
    queryFn: () =>
      usersApi.list({
        ...(role !== 'all' ? { role } : {}),
        ...(programId !== 'all' ? { programId } : {}),
        ...(q ? { q } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Users"
        subtitle={`${query.data?.length ?? 0} matching user${(query.data?.length ?? 0) === 1 ? '' : 's'}`}
        action={
          !isReadOnly && (
            <Link to="/admin/users/new">
              <Button>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Invite user
              </Button>
            </Link>
          )
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full max-w-md">
            <Input
              placeholder="Search by name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="block w-full sm:w-auto">
            <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role | 'all')}
              className="w-full sm:w-48 h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
              <option value="finance">Finance</option>
              <option value="admin">Admins</option>
              <option value="superadmin">Superadmins</option>
            </select>
          </label>
          <label className="block w-full sm:w-auto">
            <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
              Program
            </span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full sm:w-56 h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="all">All programs</option>
              {(programsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />
      )}
      {query.data && (
        <Card className="p-0 overflow-hidden">
          {query.data.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No users match" />
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((u) => {
                const initial = (u.name ?? '?').trim().charAt(0).toUpperCase();
                return (
                  <li key={u.id}>
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="flex items-center gap-4 p-4 sm:p-5 hover:bg-surface-muted/70 transition-colors group"
                    >
                      <span
                        aria-hidden
                        className="shrink-0 h-10 w-10 rounded-xl bg-navy-100 text-brand-navy font-bold grid place-items-center"
                      >
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {u.email} · <span className="capitalize">{u.role}</span>
                          {u.code && (
                            <>
                              {' '}
                              · <span className="font-mono">{u.code}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <Badge
                        tone={
                          u.status === 'active'
                            ? 'success'
                            : u.status === 'suspended'
                              ? 'danger'
                              : 'warning'
                        }
                        dot
                      >
                        {u.status}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export function AdminInviteUser() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    role: 'student' as Role,
    name: '',
    email: '',
    phoneE164: '',
    programId: '',
    batchId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mut = useMutation({
    mutationFn: () =>
      usersApi.create({
        role: form.role,
        name: form.name,
        email: form.email,
        phoneE164: form.phoneE164 || undefined,
        programId: form.programId || undefined,
        batchId: form.batchId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setSuccess(true);
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Failed.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    mut.mutate();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="People"
        title="Invite a user"
        subtitle="They'll receive a magic-link email to set their password."
        back={{ to: '/admin/users', label: 'Back to users' }}
      />

      <Card accent="orange">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
              Role
            </span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <Input
            label="Full name"
            placeholder="Jane Doe"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            label="Phone"
            placeholder="+919812345678"
            value={form.phoneE164}
            onChange={(e) => setForm((f) => ({ ...f, phoneE164: e.target.value }))}
            hint="E.164 format (e.g. +919812345678)"
          />
          {form.role === 'student' && (
            <>
              <Input
                label="Program ID"
                value={form.programId}
                onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
                hint="Find it on the Programs page."
              />
              <Input
                label="Batch ID"
                value={form.batchId}
                onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
              />
            </>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 text-success p-3 text-sm"
            >
              Invite sent.
            </div>
          )}
          <Button type="submit" size="lg" loading={mut.isPending}>
            Send invite
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const isReadOnly = me?.role === 'superadmin';
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id!),
    enabled: Boolean(id),
  });
  const suspend = useMutation({
    mutationFn: () => usersApi.suspend(id!, 'Admin action'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', id] }),
  });
  const unsuspend = useMutation({
    mutationFn: () => usersApi.unsuspend(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', id] }),
  });
  const resend = useMutation({
    mutationFn: () => usersApi.resendInvite(id!),
  });

  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const u = query.data!;
  const initial = (u.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="People"
        title={u.name}
        subtitle={u.email}
        back={{ to: '/admin/users', label: 'Back to users' }}
      />

      <Card accent="navy">
        <div className="flex items-center gap-4 mb-5">
          <div
            aria-hidden
            className="shrink-0 h-16 w-16 rounded-2xl bg-accent-gradient text-white font-bold text-2xl grid place-items-center shadow-glow-orange"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="info" dot>
                {u.role}
              </Badge>
              <Badge
                tone={
                  u.status === 'active'
                    ? 'success'
                    : u.status === 'suspended'
                      ? 'danger'
                      : 'warning'
                }
                dot
              >
                {u.status}
              </Badge>
            </div>
            {u.code && (
              <p className="text-xs font-mono text-muted mt-2">{u.code}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-y-2.5 text-sm border-t border-black/5 pt-4">
          <dt className="text-muted">Phone</dt>
          <dd className="font-mono">{u.phoneE164 || '—'}</dd>
        </dl>
      </Card>

      {!isReadOnly && (
        <Card accent="orange">
          <CardHeader title="Actions" />
          <div className="flex flex-wrap gap-3">
            {u.status === 'active' ? (
              <Button variant="danger" loading={suspend.isPending} onClick={() => suspend.mutate()}>
                Suspend
              </Button>
            ) : (
              <Button loading={unsuspend.isPending} onClick={() => unsuspend.mutate()}>
                Unsuspend
              </Button>
            )}
            {u.status === 'pending' && (
              <Button
                variant="secondary"
                loading={resend.isPending}
                onClick={() => resend.mutate()}
              >
                Resend invite
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
