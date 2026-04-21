import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { Role } from 'india-learns-shared-types';
import { usersApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { ApiHttpError } from '../../lib/api.js';
import { useAuthStore } from '../../store/auth.js';

export function AdminUsers() {
  const me = useAuthStore((s) => s.user);
  const isReadOnly = me?.role === 'superadmin';
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['users', role, q],
    queryFn: () =>
      usersApi.list({
        ...(role !== 'all' ? { role } : {}),
        ...(q ? { q } : {}),
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">Users</h1>
        {!isReadOnly && (
          <Link to="/admin/users/new">
            <Button>Invite user</Button>
          </Link>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role | 'all')}
            className="h-10 px-3 rounded-lg border border-black/10 bg-white"
          >
            <option value="all">All roles</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty</option>
            <option value="finance">Finance</option>
            <option value="admin">Admins</option>
            <option value="superadmin">Superadmins</option>
          </select>
        </div>
      </Card>

      {query.isLoading && <Skeleton lines={5} />}
      {query.isError && <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && (
        <Card>
          {query.data.length === 0 ? (
            <EmptyState title="No users match" />
          ) : (
            <ul className="divide-y divide-black/5">
              {query.data.map((u) => (
                <li key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link to={`/admin/users/${u.id}`} className="font-medium text-brand-navy hover:underline">
                      {u.name}
                    </Link>
                    <p className="text-xs text-muted truncate">{u.email} · <span className="capitalize">{u.role}</span>{u.code && <> · <span className="mono">{u.code}</span></>}</p>
                  </div>
                  <Badge tone={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'warning'}>
                    {u.status}
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
    <div className="space-y-4 max-w-2xl">
      <Link to="/admin/users" className="text-sm text-brand-orange hover:underline">← Back to users</Link>
      <h1 className="text-2xl font-bold text-brand-navy">Invite a user</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <Input label="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Phone (E.164, e.g. +919812345678)" value={form.phoneE164} onChange={(e) => setForm((f) => ({ ...f, phoneE164: e.target.value }))} />
          {form.role === 'student' && (
            <>
              <Input label="Program ID" value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))} hint="Find it on the Programs page." />
              <Input label="Batch ID" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))} />
            </>
          )}
          {error && <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-success p-3 text-sm">Invite sent.</div>}
          <Button type="submit" loading={mut.isPending}>Send invite</Button>
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

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const u = query.data!;

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/admin/users" className="text-sm text-brand-orange hover:underline">← Back to users</Link>
      <h1 className="text-2xl font-bold text-brand-navy">{u.name}</h1>
      <Card>
        <dl className="grid grid-cols-[1fr_2fr] gap-y-2 text-sm">
          <dt className="text-muted">Role</dt><dd className="capitalize">{u.role}</dd>
          <dt className="text-muted">Email</dt><dd>{u.email}</dd>
          <dt className="text-muted">Phone</dt><dd>{u.phoneE164 || '—'}</dd>
          <dt className="text-muted">Status</dt><dd>
            <Badge tone={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'warning'}>
              {u.status}
            </Badge>
          </dd>
          {u.code && <><dt className="text-muted">Code</dt><dd className="mono">{u.code}</dd></>}
        </dl>
      </Card>
      {!isReadOnly && (
        <Card>
          <CardHeader title="Actions" />
          <div className="flex flex-wrap gap-3">
            {u.status === 'active' ? (
              <Button variant="danger" loading={suspend.isPending} onClick={() => suspend.mutate()}>Suspend</Button>
            ) : (
              <Button loading={unsuspend.isPending} onClick={() => unsuspend.mutate()}>Unsuspend</Button>
            )}
            {u.status === 'pending' && (
              <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Resend invite</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
