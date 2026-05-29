import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import {
  APPLICATION_DOCUMENT_TYPE_LABELS,
  PROGRAM_REQUIRED_DOC_TYPES,
  VISITOR_LEAD_SOURCES,
  type ContactRefDto,
  type PersonalAddressDto,
  type ProgramRequiredDocType,
  type Role,
  type UserPublicDto,
  type VisitorLeadSource,
} from 'india-learns-shared-types';
import { usersApi, programsApi, batchesApi, filesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { FileLink } from '../../components/FileLink.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { ApiHttpError, api } from '../../lib/api.js';

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

// M10v — Invite form now captures full Section 1 (Academic) detail at
// invite time. Admin can fill name + email + phone (required) and
// optionally expand collapsible cards to enter DOB / personal address
// / emergency contact / parent guardian. After Create the admin is
// redirected to the user detail page with a banner pointing them at
// the document uploader so SSLC / Plus Two / Degree / Gov ID can be
// attached in the same workflow.

// M10x — Marketing source labels (Excel "Source: Meta / Google / Agent").
const SOURCE_LABEL: Record<VisitorLeadSource, string> = {
  reference: 'Reference',
  google: 'Google',
  social_media: 'Social Media',
  walk_in: 'Walk-in',
  meta: 'Meta (FB / IG ads)',
  agent: 'Agent',
  other: 'Other',
};

function emptyAddress() {
  return {
    street: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: 'India',
  };
}
function emptyContact() {
  return { name: '', relationship: '', phoneE164: '', email: '' };
}

function isContactBlank(c: { name: string; phoneE164: string }): boolean {
  return !c.name.trim() && !c.phoneE164.trim();
}
function isAddressBlank(a: { street: string; city: string; stateProvince: string; postalCode: string }): boolean {
  return !a.street.trim() && !a.city.trim() && !a.stateProvince.trim() && !a.postalCode.trim();
}

export function AdminInviteUser() {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
    dateOfBirth: '',
    // M10x — Marketing source (Excel "Source" column).
    source: '' as VisitorLeadSource | '',
    address: emptyAddress(),
    emergency: emptyContact(),
    parent: emptyContact(),
  });
  // Collapsed by default — admin can skip these when they don't have
  // the data yet. Section 1 of the requirements asks for all of it but
  // the workflow stays usable when only basics are known.
  const [showAddress, setShowAddress] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      usersApi.create({
        role: form.role,
        name: form.name,
        email: form.email,
        phoneE164: form.phoneE164 || undefined,
        programId: form.programId || undefined,
        batchId: form.batchId || undefined,
        dateOfBirth: form.dateOfBirth.trim() || null,
        source: form.source || null,
        personalAddress: isAddressBlank(form.address)
          ? null
          : {
              street: form.address.street.trim(),
              city: form.address.city.trim(),
              stateProvince: form.address.stateProvince.trim(),
              postalCode: form.address.postalCode.trim(),
              country: form.address.country.trim() || 'India',
            },
        emergencyContact: isContactBlank(form.emergency)
          ? null
          : {
              name: form.emergency.name.trim(),
              relationship: form.emergency.relationship.trim(),
              phoneE164: form.emergency.phoneE164.trim(),
              email: form.emergency.email.trim() || null,
            },
        parentGuardian: isContactBlank(form.parent)
          ? null
          : {
              name: form.parent.name.trim(),
              relationship: form.parent.relationship.trim(),
              phoneE164: form.parent.phoneE164.trim(),
              email: form.parent.email.trim() || null,
            },
      }),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      // M10v — Land on the new user's detail page with a banner that
      // points at the document uploader (StudentDocuments / Resume
      // editors live there). The student's SSLC / +2 / Degree / Gov
      // ID / Transfer cert / Photo can be uploaded in the same flow.
      navigate(`/admin/users/${user.id}?invited=1`);
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Failed.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mut.mutate();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="People"
        title="Invite a user"
        subtitle="They'll receive a magic-link email to set their password. Optional fields can be filled now or later from the user's detail page."
        back={{ to: '/admin/users', label: 'Back to users' }}
      />

      <Card accent="orange">
        <form onSubmit={onSubmit} className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Basics
          </h3>
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

          {form.role === 'student' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Date of birth (optional)"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
                  }
                />
                {/* M10x — Excel "Source" column. Where did the student
                    come from? Used for placement / marketing reports. */}
                <label className="block">
                  <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
                    Source (optional)
                  </span>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        source: e.target.value as VisitorLeadSource | '',
                      }))
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                  >
                    <option value="">— Select —</option>
                    {VISITOR_LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {SOURCE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    How did the student come in? Already on the visitor lead
                    if you captured them there first — copy that value here.
                  </p>
                </label>
              </div>

              <CollapsibleSection
                title="Personal address"
                subtitle="Where the student lives. You can fill this later from their detail page."
                open={showAddress}
                onToggle={() => setShowAddress((v) => !v)}
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Street"
                      value={form.address.street}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          address: { ...f.address, street: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Input
                    label="City"
                    value={form.address.city}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        address: { ...f.address, city: e.target.value },
                      }))
                    }
                  />
                  <Input
                    label="State"
                    value={form.address.stateProvince}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        address: { ...f.address, stateProvince: e.target.value },
                      }))
                    }
                  />
                  <Input
                    label="Pin code"
                    value={form.address.postalCode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        address: { ...f.address, postalCode: e.target.value },
                      }))
                    }
                  />
                  <Input
                    label="Country"
                    value={form.address.country}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        address: { ...f.address, country: e.target.value },
                      }))
                    }
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Emergency contact"
                subtitle="Person we call if there's a serious issue. Phone is required if filling this section."
                open={showEmergency}
                onToggle={() => setShowEmergency((v) => !v)}
              >
                <ContactFields
                  value={form.emergency}
                  onChange={(patch) =>
                    setForm((f) => ({ ...f, emergency: { ...f.emergency, ...patch } }))
                  }
                />
              </CollapsibleSection>

              <CollapsibleSection
                title="Parent / guardian"
                subtitle="Will be CC'd on fee reminders and the daily attendance summary email."
                open={showParent}
                onToggle={() => setShowParent((v) => !v)}
              >
                <ContactFields
                  value={form.parent}
                  onChange={(patch) =>
                    setForm((f) => ({ ...f, parent: { ...f.parent, ...patch } }))
                  }
                />
              </CollapsibleSection>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
                <p className="font-medium">After invite, you'll land on the student's detail page.</p>
                <p className="mt-0.5 text-amber-800/90">
                  That's where you upload SSLC / Plus Two / Degree / ID
                  proof / Transfer certificate / Passport photo —
                  documents need the student id, which is created when
                  you send the invite.
                </p>
              </div>
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
          <Button type="submit" size="lg" loading={mut.isPending}>
            Send invite
          </Button>
        </form>
      </Card>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-surface-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-semibold text-brand-navy text-sm">{title}</p>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        </div>
        <span className="text-brand-navy font-mono">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-black/5">{children}</div>}
    </div>
  );
}

function ContactFields({
  value,
  onChange,
}: {
  value: { name: string; relationship: string; phoneE164: string; email: string };
  onChange: (
    patch: Partial<{ name: string; relationship: string; phoneE164: string; email: string }>,
  ) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Input
        label="Name"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Input
        label="Relationship"
        value={value.relationship}
        onChange={(e) => onChange({ relationship: e.target.value })}
        placeholder="Father / Mother / Guardian / Spouse"
      />
      <Input
        type="tel"
        label="Phone"
        value={value.phoneE164}
        onChange={(e) => onChange({ phoneE164: e.target.value })}
        placeholder="+919876543210"
      />
      <Input
        type="email"
        label="Email"
        value={value.email}
        onChange={(e) => onChange({ email: e.target.value })}
      />
    </div>
  );
}

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const isReadOnly = false; // superadmin now has full write access (round 3)
  const qc = useQueryClient();
  // M10v — Banner after a fresh invite ("?invited=1") so admin knows
  // exactly where to go next: upload SSLC / Plus Two / Degree / Gov ID /
  // Transfer cert / Photo via the documents card lower on this page.
  const [justInvited, setJustInvited] = useState(
    typeof window !== 'undefined' && window.location.search.includes('invited=1'),
  );
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

      {justInvited && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 text-success p-4 text-sm flex items-start gap-3"
        >
          <span aria-hidden className="text-xl">✅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Invite sent — magic-link email is on the way.</p>
            <p className="mt-0.5 text-success/90">
              Scroll down to the <strong>Documents</strong> card to upload SSLC / Plus
              Two / Degree / ID proof / Transfer certificate / Passport photo. The
              student can also upload these themselves after accepting the invite.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJustInvited(false)}
            className="text-success/70 hover:text-success"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

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
          <SourceEditor user={u} onSaved={() => qc.invalidateQueries({ queryKey: ['users', id] })} />
          {u.role === 'student' && <StudentDocumentsEditor studentId={u.id} />}
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
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    setUrl(user.resumeUrl ?? '');
  }, [user.id, user.resumeUrl]);

  const save = useMutation({
    mutationFn: (nextUrl: string) =>
      usersApi.update(user.id, { resumeUrl: nextUrl.trim() || null }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Resume saved.' });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  async function onFile(file: File) {
    setMsg(null);
    setUploading(true);
    try {
      const { url: uploadedUrl } = await filesApi.upload(file, 'resumes');
      setUrl(uploadedUrl);
      save.mutate(uploadedUrl);
    } catch (err) {
      setMsg({ kind: 'err', text: errMsg(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Resume"
        subtitle="The link the placement team sees on every job application. Upload a PDF or paste a Drive / Dropbox / portfolio URL."
      />
      <div className="space-y-3">
        <label
          htmlFor={`resume-upload-${user.id}`}
          className="block rounded-xl border border-dashed border-brand-navy/30 px-4 py-6 text-center cursor-pointer hover:bg-surface-muted/40 transition-colors"
        >
          <input
            id={`resume-upload-${user.id}`}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="sr-only"
            disabled={uploading || save.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <span className="text-sm font-medium text-brand-navy">
            {uploading ? 'Uploading…' : 'Click to upload a PDF'}
          </span>
          <span className="block text-xs text-muted mt-1">
            We host it on India Learns; the placement team gets the link.
          </span>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            save.mutate(url);
          }}
          className="space-y-3"
        >
          <Input
            label="Or paste a URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            hint="Leave blank to clear."
          />
          {url && (
            <FileLink url={url} className="text-sm text-brand-orange hover:underline">
              Open current resume →
            </FileLink>
          )}
          <StatusBanner msg={msg} />
          <Button type="submit" loading={save.isPending}>
            Save URL
          </Button>
        </form>
      </div>
    </Card>
  );
}

// M10x — Marketing source editor. Mirrors the Excel "Source" column;
// admin can change it any time post-invite (e.g., turns out the lead
// originally came from Meta but Logan misclassified as Walk-in).
function SourceEditor({ user, onSaved }: EditorProps) {
  const [source, setSource] = useState<VisitorLeadSource | ''>(user.source ?? '');
  const [msg, setMsg] = useFieldMsg();
  useEffect(() => {
    setSource(user.source ?? '');
  }, [user.id, user.source]);

  const save = useMutation({
    mutationFn: () =>
      usersApi.update(user.id, { source: (source || null) as VisitorLeadSource | null }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Source saved.' });
      onSaved();
    },
    onError: (err) => setMsg({ kind: 'err', text: errMsg(err) }),
  });

  return (
    <Card>
      <CardHeader
        title="Marketing source"
        subtitle="How did this student come to India Learns? Used for placement / marketing reports and matches the Excel template's “Source” column."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="space-y-3"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted font-bold">
            Source
          </span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as VisitorLeadSource | '')}
            className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
          >
            <option value="">— Not specified —</option>
            {VISITOR_LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <StatusBanner msg={msg} />
        <Button type="submit" loading={save.isPending}>
          Save source
        </Button>
      </form>
    </Card>
  );
}

// M10k + M10q — Student documents editor. Admin uploads SSLC / Plus Two /
// Degree / Transfer Certificate / Passport Photo / Gov ID etc. on behalf
// of a student. M10q adds direct file upload via /v1/files/upload (Mongo
// GridFS in default config). Pasting a Drive / Dropbox URL still works
// for things the admin already has hosted elsewhere.

interface StudentDocumentItem {
  id: string;
  documentType: ProgramRequiredDocType;
  label: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedByUserId: string;
  uploadedAt: string;
}

function StudentDocumentsEditor({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const docsQ = useQuery({
    queryKey: ['students', studentId, 'documents'],
    queryFn: async () => {
      const res = await api.get<{ data: { items: StudentDocumentItem[] } }>(
        `/students/${studentId}/documents`,
      );
      return res.data.data.items;
    },
  });

  const [docType, setDocType] = useState<ProgramRequiredDocType>('govid');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useMutation({
    mutationFn: () =>
      api.post(`/students/${studentId}/documents`, {
        documentType: docType,
        label: label.trim() || undefined,
        url: url.trim(),
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Document added.' });
      setUrl('');
      setLabel('');
      qc.invalidateQueries({ queryKey: ['students', studentId, 'documents'] });
    },
    onError: (err) =>
      setMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Failed to add document.',
      }),
  });

  async function onFile(file: File) {
    setMsg(null);
    setUploading(true);
    try {
      const { url: uploadedUrl } = await filesApi.upload(file, 'student-documents');
      setUrl(uploadedUrl);
      setMsg({ kind: 'ok', text: 'File uploaded — review the type / label, then save.' });
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Upload failed.',
      });
    } finally {
      setUploading(false);
    }
  }

  const remove = useMutation({
    mutationFn: (docId: string) => api.delete(`/students/${studentId}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', studentId, 'documents'] }),
  });

  return (
    <Card>
      <CardHeader
        title="Documents"
        subtitle="SSLC, Plus Two, Degree, Transfer Certificate, Passport photo, ID proof. Upload a file (PDF / image) or paste a Drive / Dropbox link."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          if (!url.trim()) {
            setMsg({ kind: 'err', text: 'Upload a file or paste a URL first.' });
            return;
          }
          upload.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Document type
            </span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as ProgramRequiredDocType)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {PROGRAM_REQUIRED_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {APPLICATION_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={APPLICATION_DOCUMENT_TYPE_LABELS[docType]}
          />
          <Input
            label="File URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Choose a file below or paste a URL"
            hint="Auto-populated after upload."
          />
        </div>
        <label
          htmlFor={`student-doc-upload-${studentId}`}
          className="block rounded-xl border border-dashed border-brand-navy/30 px-4 py-4 text-center cursor-pointer hover:bg-surface-muted/40 transition-colors"
        >
          <input
            id={`student-doc-upload-${studentId}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={uploading || upload.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <span className="text-sm font-medium text-brand-navy">
            {uploading ? 'Uploading…' : 'Click to upload a PDF or image (max 5 MB)'}
          </span>
        </label>
        <StatusBanner msg={msg} />
        <Button type="submit" loading={upload.isPending}>
          Add document
        </Button>
      </form>

      {docsQ.isLoading && <div className="mt-4"><Skeleton lines={2} /></div>}
      {docsQ.data && docsQ.data.length === 0 && (
        <div className="mt-4">
          <EmptyState title="No documents on file" message="" />
        </div>
      )}
      {docsQ.data && docsQ.data.length > 0 && (
        <ul className="mt-4 divide-y divide-black/5">
          {docsQ.data.map((d) => (
            <li key={d.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-brand-navy">
                  {d.label || APPLICATION_DOCUMENT_TYPE_LABELS[d.documentType]}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {APPLICATION_DOCUMENT_TYPE_LABELS[d.documentType]} ·{' '}
                  {new Date(d.uploadedAt).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FileLink url={d.url} className="text-sm text-brand-orange hover:underline">
                  Open
                </FileLink>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm('Remove this document?')) remove.mutate(d.id);
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
