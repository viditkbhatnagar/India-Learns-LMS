import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  ContactRefDto,
  PersonalAddressDto,
  Role,
  UserPublicDto,
} from 'india-learns-shared-types';
import { usersApi, programsApi, batchesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { ApiHttpError } from '../../lib/api.js';

export function AdminUsers() {
  const isReadOnly = false; // superadmin now has full write access (round 3)
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
  // PR #18 — faculty now also takes a `programId` so Logan can assign
  // each instructor to a program (Aviation / Retail / etc.). The select
  // populates from the live programs list — no more "find it on the
  // Programs page and paste the ObjectId" friction.
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
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
          {(form.role === 'student' || form.role === 'faculty') && (
            <>
              <label className="block">
                <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
                  Program
                </span>
                <select
                  value={form.programId}
                  onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                  required={form.role === 'student'}
                >
                  <option value="">
                    {form.role === 'faculty' ? '— No program (assign later) —' : 'Pick a program…'}
                  </option>
                  {(programsQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1">
                  {form.role === 'faculty'
                    ? 'Optional — pick the program this faculty member teaches in.'
                    : 'Required — which program is the student joining?'}
                </p>
              </label>
              {form.role === 'student' && (
                <Input
                  label="Batch ID"
                  value={form.batchId}
                  onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
                />
              )}
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
  const isReadOnly = false; // superadmin now has full write access (round 3)
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
          <dt className="text-muted">Email</dt>
          <dd>{u.email}</dd>
          {u.dateOfBirth && (
            <>
              <dt className="text-muted">Date of birth</dt>
              <dd>{new Date(u.dateOfBirth).toLocaleDateString('en-IN')}</dd>
            </>
          )}
          {u.enrolmentValidFrom && u.enrolmentValidTo && (
            <>
              <dt className="text-muted">Enrolment window</dt>
              <dd>
                {new Date(u.enrolmentValidFrom).toLocaleDateString('en-IN')} –{' '}
                {new Date(u.enrolmentValidTo).toLocaleDateString('en-IN')}
              </dd>
            </>
          )}
        </dl>
      </Card>

      {/* M10h — Admin-side academic-data edit. Mirrors the student
          Profile screen so admin / admissions team can correct details
          on behalf of a student without asking them to log in. The PATCH
          /v1/users/:id endpoint already accepts all these fields (PR-B);
          this is the missing admin UI. */}
      {!isReadOnly && (
        <>
          <AdmissionDetailsEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
          <PersonalDetailsEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
          <EmergencyContactEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
          <ParentGuardianEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
          <ResumeUrlEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
        </>
      )}

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

// M10h — Admin-side editors for academic data. Each card has its own
// save mutation + status banner so one failing block doesn't trap the
// others. The PATCH endpoint accepts each field independently — missing
// keys are left untouched, so passing only the subdoc you're editing
// is safe.

interface EditorProps {
  user: UserPublicDto;
  onSaved: () => void;
}

function useFieldMsg() {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  return [msg, setMsg] as const;
}

function StatusBanner({ msg }: { msg: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      role={msg.kind === 'ok' ? 'status' : 'alert'}
      className={`rounded-xl p-3 text-sm ${
        msg.kind === 'ok'
          ? 'bg-emerald-50 border border-emerald-200 text-success'
          : 'bg-red-50 border border-danger/30 text-danger'
      }`}
    >
      {msg.text}
    </div>
  );
}

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? err.message : 'Failed to save.';
}

function AdmissionDetailsEditor({ user, onSaved }: EditorProps) {
  const [programId, setProgramId] = useState(user.programId ?? '');
  const [batchId, setBatchId] = useState(user.batchId ?? '');
  const [validFrom, setValidFrom] = useState(
    user.enrolmentValidFrom ? user.enrolmentValidFrom.slice(0, 10) : '',
  );
  const [validTo, setValidTo] = useState(
    user.enrolmentValidTo ? user.enrolmentValidTo.slice(0, 10) : '',
  );
  const [msg, setMsg] = useFieldMsg();
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const batchesQ = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list() as Promise<Array<{ id: string; name: string; programId: string }>>,
  });
  const filteredBatches = (batchesQ.data ?? []).filter((b) => !programId || b.programId === programId);

  const save = useMutation({
    mutationFn: () =>
      usersApi.update(user.id, {
        programId: programId || null,
        batchId: batchId || null,
        enrolmentValidFrom: validFrom ? new Date(`${validFrom}T00:00:00Z`).toISOString() : null,
        enrolmentValidTo: validTo ? new Date(`${validTo}T00:00:00Z`).toISOString() : null,
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Admission details saved.' });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  return (
    <Card>
      <CardHeader
        title="Admission details"
        subtitle="Programme, batch, and enrolment window. Changing programme triggers re-enrolment downstream — confirm with finance first."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Programme</span>
            <select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setBatchId('');
              }}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">— None —</option>
              {(programsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Batch</span>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">— None —</option>
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Joining date (enrolment from)"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
          <Input
            label="Enrolment until"
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </div>
        <StatusBanner msg={msg} />
        <Button type="submit" loading={save.isPending}>
          Save admission details
        </Button>
      </form>
    </Card>
  );
}

function PersonalDetailsEditor({ user, onSaved }: EditorProps) {
  const [dob, setDob] = useState(user.dateOfBirth ?? '');
  const blankAddr: PersonalAddressDto = {
    street: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
  };
  const [addr, setAddr] = useState<PersonalAddressDto>(user.personalAddress ?? blankAddr);
  const [msg, setMsg] = useFieldMsg();
  useEffect(() => {
    setDob(user.dateOfBirth ?? '');
    setAddr(user.personalAddress ?? blankAddr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const save = useMutation({
    mutationFn: () =>
      usersApi.update(user.id, {
        dateOfBirth: dob.trim() ? dob.trim() : null,
        personalAddress:
          addr.street.trim() && addr.city.trim() && addr.country.trim()
            ? {
                street: addr.street.trim(),
                city: addr.city.trim(),
                stateProvince: addr.stateProvince.trim(),
                postalCode: addr.postalCode.trim(),
                country: addr.country.trim(),
              }
            : null,
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Personal details saved.' });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  return (
    <Card>
      <CardHeader
        title="Personal details"
        subtitle="Date of birth and full residential address. Leaving address blank clears it."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="space-y-3"
      >
        <Input
          label="Date of birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Street" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} maxLength={200} />
          <Input label="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} maxLength={120} />
          <Input label="State / province" value={addr.stateProvince} onChange={(e) => setAddr({ ...addr, stateProvince: e.target.value })} maxLength={120} />
          <Input label="Postal code" value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} maxLength={32} />
          <Input label="Country" value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} maxLength={80} />
        </div>
        <StatusBanner msg={msg} />
        <Button type="submit" loading={save.isPending}>
          Save personal details
        </Button>
      </form>
    </Card>
  );
}

function ContactEditor({
  user,
  field,
  title,
  subtitle,
  onSaved,
}: EditorProps & {
  field: 'emergencyContact' | 'parentGuardian';
  title: string;
  subtitle: string;
}) {
  const blank: ContactRefDto = { name: '', relationship: '', phoneE164: '', email: null };
  const [contact, setContact] = useState<ContactRefDto>(user[field] ?? blank);
  const [msg, setMsg] = useFieldMsg();
  useEffect(() => {
    setContact(user[field] ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, field]);

  const save = useMutation({
    mutationFn: () =>
      usersApi.update(user.id, {
        [field]:
          contact.name.trim() && contact.phoneE164.trim()
            ? {
                name: contact.name.trim(),
                relationship: contact.relationship.trim(),
                phoneE164: contact.phoneE164.trim(),
                email: contact.email?.trim() || null,
              }
            : null,
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: `${title} saved.` });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} maxLength={120} />
          <Input
            label="Relationship"
            value={contact.relationship}
            onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
            maxLength={60}
          />
          <Input
            label="Phone"
            value={contact.phoneE164}
            onChange={(e) => setContact({ ...contact, phoneE164: e.target.value })}
            placeholder="+919812345678"
            hint="E.164 format"
          />
          <Input
            label="Email (optional)"
            type="email"
            value={contact.email ?? ''}
            onChange={(e) => setContact({ ...contact, email: e.target.value || null })}
            maxLength={254}
          />
        </div>
        <StatusBanner msg={msg} />
        <Button type="submit" loading={save.isPending}>
          Save {title.toLowerCase()}
        </Button>
      </form>
    </Card>
  );
}

function EmergencyContactEditor(props: EditorProps) {
  return (
    <ContactEditor
      {...props}
      field="emergencyContact"
      title="Emergency contact"
      subtitle="Whom we call if something happens during class or on campus."
    />
  );
}

function ParentGuardianEditor(props: EditorProps) {
  return (
    <ContactEditor
      {...props}
      field="parentGuardian"
      title="Parent / guardian"
      subtitle="Primary contact for programme updates, fee reminders, attendance summaries."
    />
  );
}

function ResumeUrlEditor({ user, onSaved }: EditorProps) {
  const [url, setUrl] = useState(user.resumeUrl ?? '');
  const [msg, setMsg] = useFieldMsg();
  useEffect(() => {
    setUrl(user.resumeUrl ?? '');
  }, [user.id, user.resumeUrl]);

  const save = useMutation({
    mutationFn: () => usersApi.update(user.id, { resumeUrl: url.trim() || null }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Resume URL saved.' });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  return (
    <Card>
      <CardHeader
        title="Resume"
        subtitle="Canonical link shown to the placement team on every job application. Drive / Dropbox / portfolio URL."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="space-y-3"
      >
        <Input
          label="Resume URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          hint="Leave blank to clear."
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-brand-orange hover:underline"
          >
            Open current resume →
          </a>
        )}
        <StatusBanner msg={msg} />
        <Button type="submit" loading={save.isPending}>
          Save resume URL
        </Button>
      </form>
    </Card>
  );
}
