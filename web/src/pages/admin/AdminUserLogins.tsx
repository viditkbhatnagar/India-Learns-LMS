import { useMemo, useState, type FormEvent, type JSX, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchDto,
  CredentialedUserDto,
  ProgramDto,
  Role,
} from 'india-learns-shared-types';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { apiErrorMessage } from '../../lib/api.js';
import { userLoginsApi, programsApi, batchesApi } from '../../lib/endpoints.js';

// Admin "create login" for ANY role, with a generated + persisted password and
// a credentials table (always visible). Email invites are off, so this is the
// working onboarding path. For students, it also enrols them in a program.

const PROVISIONABLE: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty (teacher)' },
  { value: 'admin', label: 'Admin' },
  { value: 'admissions_officer', label: 'Admissions officer' },
];
const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  admin: 'Admin',
  superadmin: 'Superadmin',
  admissions_officer: 'Admissions',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  revoked: 'neutral',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().-]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return /^\+\d{6,15}$/.test(cleaned) ? cleaned : null;
  if (cleaned.startsWith('00')) {
    const intl = `+${cleaned.slice(2)}`;
    return /^\+\d{6,15}$/.test(intl) ? intl : null;
  }
  const digits = cleaned.replace(/\D/g, '').replace(/^0+/, '');
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, className }: { text: string; className?: string }): JSX.Element {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className={className ?? 'text-xs text-brand-orange hover:underline shrink-0'}
      onClick={async () => {
        const ok = await copy(text);
        setState(ok ? 'ok' : 'fail');
        window.setTimeout(() => setState('idle'), 1500);
      }}
    >
      <span aria-live="polite">
        {state === 'ok' ? 'copied!' : state === 'fail' ? "can't copy" : 'copy'}
      </span>
    </button>
  );
}

export function AdminUserLoginsPage(): JSX.Element {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [enrol, setEnrol] = useState(true);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<
    { name: string; email: string; password: string; code: string | null; enrolmentsCount: number } | null
  >(null);
  const [copiedBoth, setCopiedBoth] = useState(false);

  const isStudent = role === 'student';

  const listQ = useQuery({ queryKey: ['user-credentials'], queryFn: () => userLoginsApi.list() });
  const programsQ = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list() as Promise<ProgramDto[]>,
    enabled: isStudent,
  });
  const batchesQ = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list() as Promise<BatchDto[]>,
    enabled: isStudent,
  });

  const batchesForProgram = useMemo(
    () => (batchesQ.data ?? []).filter((b) => b.programId === programId),
    [batchesQ.data, programId],
  );

  const createMut = useMutation({
    mutationFn: () =>
      userLoginsApi.create({
        role,
        name: name.trim(),
        email: email.trim(),
        phoneE164: normalizePhone(phone.trim())!,
        programId: isStudent && programId ? programId : undefined,
        batchId: isStudent && batchId ? batchId : undefined,
        enrol: isStudent ? enrol : undefined,
      }),
    onSuccess: (res) => {
      setFormErr(null);
      setJustCreated({
        name: res.user.name,
        email: res.user.email,
        password: res.temporaryPassword,
        code: res.user.code,
        enrolmentsCount: res.enrolmentsCount,
      });
      setName('');
      setEmail('');
      setPhone('');
      qc.invalidateQueries({ queryKey: ['user-credentials'] });
      // Keep the other surfaces fresh (the new person also shows on Users /
      // the Faculty table, and a student's enrolments changed).
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['faculty-accounts'] });
      qc.invalidateQueries({ queryKey: ['admin', 'enrollments'] });
    },
    onError: (e) => setFormErr(apiErrorMessage(e, 'Could not create the login.')),
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setEmailErr(null);
    setPhoneErr(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormErr('Name, email and phone are all required.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailErr('Enter a valid email address.');
      setFormErr('Enter a valid email address.');
      return;
    }
    if (!normalizePhone(phone.trim())) {
      setPhoneErr('Enter a 10-digit mobile number, or +country code.');
      setFormErr('Enter a valid phone number.');
      return;
    }
    if (isStudent && enrol && (!programId || !batchId)) {
      setFormErr('Pick a program and batch to enrol the student (or turn off "Enrol").');
      return;
    }
    setFormErr(null);
    createMut.mutate();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Users"
        title="Create login"
        subtitle="Add anyone — student, teacher, admin — with an auto-generated password. Copy the credentials and hand them over; they sign in at the staff login. Students are enrolled in the chosen program."
        action={
          <Link to="/admin/users" className="text-sm text-brand-navy hover:text-brand-orange">
            ← All users
          </Link>
        }
      />

      <Card>
        <CardHeader
          title="New login"
          subtitle="Password is generated automatically — no email needed."
        />
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              {PROVISIONABLE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Input label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Josmy Jaimon" autoComplete="off" />
          <Input
            label="Email (login)"
            name="email"
            type="text"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailErr) setEmailErr(null);
            }}
            placeholder="person@example.com"
            autoComplete="off"
            error={emailErr ?? undefined}
          />
          <Input
            label="Phone"
            name="phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneErr) setPhoneErr(null);
            }}
            placeholder="10-digit mobile, e.g. 9812345678"
            autoComplete="off"
            error={phoneErr ?? undefined}
          />

          {isStudent && (
            <>
              <label className="block">
                <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">Program</span>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setBatchId('');
                  }}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                >
                  <option value="">Select a program…</option>
                  {(programsQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">Batch</span>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={!programId}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white disabled:bg-surface-muted disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                >
                  <option value="">{programId ? 'Select a batch…' : 'Pick a program first'}</option>
                  {batchesForProgram.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 sm:col-span-2 lg:col-span-3 text-sm">
                <input
                  type="checkbox"
                  checked={enrol}
                  onChange={(e) => setEnrol(e.target.checked)}
                  className="accent-brand-orange"
                />
                <span>Enrol this student in the selected program (creates their course access)</span>
              </label>
            </>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
            <Button type="submit" loading={createMut.isPending}>
              Create login
            </Button>
            {formErr && (
              <span role="alert" className="text-sm text-danger">
                {formErr}
              </span>
            )}
          </div>
        </form>

        {justCreated && (
          <div className="mt-5 rounded-2xl border border-success/30 bg-success/5 p-5">
            <p className="text-sm font-semibold text-brand-navy">
              ✅ Login created for {justCreated.name} — share these credentials
              {justCreated.enrolmentsCount > 0
                ? ` · enrolled in ${justCreated.enrolmentsCount} course${justCreated.enrolmentsCount === 1 ? '' : 's'}`
                : ''}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <CredField label="Email" value={justCreated.email} />
              <CredField label="Password" value={justCreated.password} mono />
              <CredField label="Code" value={justCreated.code ?? '—'} />
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const ok = await copy(`Email: ${justCreated.email}\nPassword: ${justCreated.password}`);
                  setCopiedBoth(ok);
                  window.setTimeout(() => setCopiedBoth(false), 1500);
                }}
              >
                {copiedBoth ? 'Copied ✓' : 'Copy email + password'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Credentials table */}
      {listQ.isLoading && <Skeleton variant="card" />}
      {listQ.isError && <ErrorAlert message={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />}
      {listQ.data && listQ.data.length === 0 && (
        <EmptyState
          title="No logins created yet"
          message="Create your first login above — it'll appear here with the credentials to share."
        />
      )}
      {listQ.data && listQ.data.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-muted/40 text-left">
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Email (login)</Th>
                  <Th>Password</Th>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {listQ.data.map((u) => (
                  <CredRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }): JSX.Element {
  return <th className="px-4 py-3 font-semibold text-brand-navy whitespace-nowrap">{children}</th>;
}

function CredField({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className={mono ? 'font-mono text-brand-navy' : 'text-brand-navy'}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CredRow({ user }: { user: CredentialedUserDto }): JSX.Element {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [freshPassword, setFreshPassword] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const resetMut = useMutation({
    mutationFn: () => userLoginsApi.resetPassword(user.id),
    onSuccess: (pw) => {
      setResetErr(null);
      setFreshPassword(pw);
      setRevealed(true);
      qc.invalidateQueries({ queryKey: ['user-credentials'] });
    },
    onError: (e) => setResetErr(apiErrorMessage(e, 'Reset failed — try again.')),
  });

  const password = freshPassword ?? user.password;

  return (
    <tr className="border-b border-black/5 last:border-0 hover:bg-surface-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium text-brand-navy whitespace-nowrap">{user.name}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge tone="info">{ROLE_LABEL[user.role] ?? user.role}</Badge>
      </td>
      <td className="px-4 py-3 text-ink/90 whitespace-nowrap">{user.email}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {password ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-brand-navy">{revealed ? password : '••••••••••'}</span>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="text-xs text-brand-navy/70 hover:text-brand-navy"
            >
              {revealed ? 'hide' : 'show'}
            </button>
            <CopyButton text={password} className="text-xs text-brand-orange hover:underline" />
          </span>
        ) : (
          <span className="text-xs text-muted italic">reset to view</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{user.code ?? '—'}</td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[user.status] ?? 'neutral'}>{user.status}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Button
          size="sm"
          variant="ghost"
          loading={resetMut.isPending}
          onClick={() => {
            // Reset rotates a live password + signs the person out — confirm.
            if (
              window.confirm(
                `Generate a new password for ${user.name}? Their current password stops working immediately.`,
              )
            ) {
              resetMut.mutate();
            }
          }}
          title="Generate a new password (invalidates current sessions)"
        >
          Reset password
        </Button>
        {resetErr && (
          <span role="alert" className="ml-2 text-xs text-danger">
            {resetErr}
          </span>
        )}
      </td>
    </tr>
  );
}
