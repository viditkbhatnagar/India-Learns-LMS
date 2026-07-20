import { useState, type FormEvent, type JSX, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FacultyAccountDto } from 'india-learns-shared-types';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { ApiHttpError } from '../../lib/api.js';
import { facultyAdminApi } from '../../lib/endpoints.js';

// Admin creates faculty logins with an auto-generated password. The password
// is persisted (encrypted server-side) and shown back here so the admin can
// hand email + password to the teacher. Faculty then sign in at /login and
// land on their dashboard; assigning them to courses happens on the course
// page's "Teaching faculty" card.

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';
const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  revoked: 'neutral',
};

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard blocked (insecure context / http origin) — the value is
    // visible on screen for manual copy.
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/;

/** Copy affordance with transient "copied!" (and "can't copy" on failure) feedback. */
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

export function AdminFacultyPage(): JSX.Element {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ faculty: FacultyAccountDto; password: string } | null>(null);
  const [copiedBoth, setCopiedBoth] = useState(false);

  const q = useQuery({
    queryKey: ['faculty-accounts'],
    queryFn: () => facultyAdminApi.list(),
  });

  const createMut = useMutation({
    mutationFn: () => facultyAdminApi.create({ name: name.trim(), email: email.trim(), phoneE164: phone.trim() }),
    onSuccess: (res) => {
      setFormErr(null);
      setJustCreated({ faculty: res.faculty, password: res.temporaryPassword });
      setName('');
      setEmail('');
      setPhone('');
      qc.invalidateQueries({ queryKey: ['faculty-accounts'] });
    },
    onError: (e) => setFormErr(e instanceof ApiHttpError ? e.message : 'Could not create the faculty login.'),
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
    if (!PHONE_RE.test(phone.trim())) {
      setPhoneErr('Enter a valid phone number, e.g. +919812345678.');
      setFormErr('Enter a valid phone number, e.g. +919812345678.');
      return;
    }
    setFormErr(null);
    createMut.mutate();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Onboarding"
        title="Faculty"
        subtitle="Create teacher logins with an auto-generated password, then share the credentials. Faculty sign in at the staff login and land on their dashboard."
      />

      {/* Create form */}
      <Card>
        <CardHeader
          title="Add a faculty login"
          subtitle="Enter their details — the password is generated automatically."
        />
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Full name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Menon"
            autoComplete="off"
          />
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
            placeholder="teacher@example.com"
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
            placeholder="+91 98123 45678"
            hint="E.164 — spaces/dashes are fine."
            autoComplete="off"
            error={phoneErr ?? undefined}
          />
          <div className="sm:col-span-3 flex items-center gap-3">
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
              ✅ Login created — share these credentials with {justCreated.faculty.name}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <CredField label="Email" value={justCreated.faculty.email} />
              <CredField label="Password" value={justCreated.password} mono />
              <CredField label="Faculty code" value={justCreated.faculty.code ?? '—'} />
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const ok = await copy(
                    `Email: ${justCreated.faculty.email}\nPassword: ${justCreated.password}`,
                  );
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

      {/* Faculty table */}
      {q.isLoading && <Skeleton variant="card" />}
      {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState
          title="No faculty yet"
          message="Create your first faculty login above — it'll appear here with the credentials to share."
        />
      )}
      {q.data && q.data.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-muted/40 text-left">
                  <Th>Name</Th>
                  <Th>Email (login)</Th>
                  <Th>Password</Th>
                  <Th>Code</Th>
                  <Th>Courses</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((f) => (
                  <FacultyRow key={f.id} faculty={f} />
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

function FacultyRow({ faculty }: { faculty: FacultyAccountDto }): JSX.Element {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [freshPassword, setFreshPassword] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const resetMut = useMutation({
    mutationFn: () => facultyAdminApi.resetPassword(faculty.id),
    onSuccess: (pw) => {
      setResetErr(null);
      setFreshPassword(pw);
      setRevealed(true);
      qc.invalidateQueries({ queryKey: ['faculty-accounts'] });
    },
    onError: (e) => setResetErr(e instanceof ApiHttpError ? e.message : 'Reset failed — try again.'),
  });

  const password = freshPassword ?? faculty.password;
  const tone = STATUS_TONE[faculty.status] ?? 'neutral';

  return (
    <tr className="border-b border-black/5 last:border-0 hover:bg-surface-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium text-brand-navy whitespace-nowrap">{faculty.name}</td>
      <td className="px-4 py-3 text-ink/90 whitespace-nowrap">{faculty.email}</td>
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
          <span className="text-xs text-muted italic">invite-set · reset to view</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{faculty.code ?? '—'}</td>
      <td className="px-4 py-3 text-center">{faculty.coursesCount}</td>
      <td className="px-4 py-3">
        <Badge tone={tone}>{faculty.status}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Button
          size="sm"
          variant="ghost"
          loading={resetMut.isPending}
          onClick={() => resetMut.mutate()}
          title="Generate a new password (invalidates their current sessions)"
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
