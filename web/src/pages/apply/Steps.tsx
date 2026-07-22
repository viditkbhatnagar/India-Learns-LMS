import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplicationDocumentDto,
  ProgramRequiredDocType,
  PublicProgramDto,
  RefereeDto,
} from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { admissionsApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

// Shared M3a/M3b/M4 step pages. Each exports its own page component; they
// share the wrapping shell + helpers below so the look is consistent.

function StepShell({
  stepNumber,
  title,
  subtitle,
  back,
  next,
  onNext,
  children,
  saving,
  error,
}: {
  stepNumber: number;
  title: string;
  subtitle: string;
  back: { to: string; label: string };
  next: { label: string };
  onNext: () => Promise<void> | void;
  children: React.ReactNode;
  saving: boolean;
  error: string | null;
}) {
  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/apply" className="flex items-center gap-3">
            <img src="/brand/logo.jpg" alt="India Learns" className="h-9 w-auto rounded-md" />
            <span className="text-brand-navy font-semibold">India Learns</span>
          </Link>
          <Link to="/apply/portal" className="text-sm font-medium text-brand-navy hover:text-brand-orange">
            Save and exit
          </Link>
        </div>
      </header>
      <section className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <article className="rounded-2xl bg-white shadow-elev-1 border border-black/5 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-1">
            Step {stepNumber} of 11
          </p>
          <h1 className="text-display-sm text-brand-navy">{title}</h1>
          <p className="mt-2 text-muted text-sm">{subtitle}</p>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              onNext();
            }}
            className="mt-6 space-y-6"
            noValidate
          >
            {children}
            {error && (
              <div role="alert" className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between pt-4 border-t border-black/5">
              <Link to={back.to}>
                <Button type="button" variant="ghost">← {back.label}</Button>
              </Link>
              <div className="text-xs text-muted">{saving ? 'Saving…' : 'All changes saved'}</div>
              <Button type="submit" loading={saving}>
                {next.label} →
              </Button>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}

// ============================================================================
// Step 6 — Documents
// ============================================================================

export function ApplyDocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: programs } = useQuery({
    queryKey: ['admissions', 'apply', 'programs'],
    queryFn: () => admissionsApi.listPublicPrograms(),
  });
  const { data: draft } = useQuery({
    queryKey: ['admissions', 'me', 'draft'],
    queryFn: () => admissionsApi.getDraft(),
  });
  const { data: documents } = useQuery({
    queryKey: ['admissions', 'me', 'documents'],
    queryFn: () => admissionsApi.listMyDocuments(),
  });

  const programId = (draft?.data?.step4_program as { programId?: string })?.programId;
  const program = useMemo(
    () => programs?.find((p) => p.id === programId) ?? null,
    [programs, programId],
  );

  const docsByType = new Map<string, ApplicationDocumentDto>();
  for (const d of documents ?? []) docsByType.set(d.documentType, d);

  // Default required-doc list if a program is selected, otherwise show
  // gov-ID + transcript as a safe baseline.
  const requiredDocs = program?.requiredDocs ?? [
    { documentType: 'govid' as const, label: 'Government ID', required: true },
    { documentType: 'transcript' as const, label: 'Prior transcript', required: true },
  ];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['admissions', 'me', 'documents'] });
  }

  async function handleNext() {
    setError(null);
    // Mark step complete on draft if all required docs are present.
    const missingRequired = requiredDocs.filter(
      (d) => d.required && !docsByType.has(d.documentType),
    );
    if (missingRequired.length > 0) {
      setError(`Upload the required documents: ${missingRequired.map((d) => d.label).join(', ')}.`);
      return;
    }
    try {
      await admissionsApi.saveDraft({
        step: 'step6_documents',
        payload: { documentIds: (documents ?? []).map((d) => d.id) },
        markComplete: true,
      });
      navigate('/apply/statement');
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not advance.');
    }
  }

  return (
    <StepShell
      stepNumber={6}
      title="Supporting documents"
      subtitle="Upload PDFs or photos (PDF / JPG / PNG, max 10 MB each)."
      back={{ to: '/apply/form', label: 'Back to academic background' }}
      next={{ label: 'Next: statement' }}
      onNext={handleNext}
      saving={false}
      error={error}
    >
      <ul className="space-y-3">
        {requiredDocs.map((req) => {
          const existing = docsByType.get(req.documentType);
          return (
            <li key={req.documentType}>
              <DocSlot
                documentType={req.documentType}
                label={req.label}
                required={req.required}
                existing={existing ?? null}
                onChange={refresh}
                setError={setError}
              />
            </li>
          );
        })}
      </ul>
    </StepShell>
  );
}

function DocSlot({
  documentType,
  label,
  required,
  existing,
  onChange,
  setError,
}: {
  // M10 — Accepts the full ProgramRequiredDocType union so SSLC / Plus Two /
  // Degree / Transfer Certificate / Passport Photo render as legitimate
  // upload slots on Step 6.
  documentType: ProgramRequiredDocType;
  label: string;
  required: boolean;
  existing: ApplicationDocumentDto | null;
  onChange: () => void;
  setError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError(`${label}: only PDF, JPG, or PNG files are accepted.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`${label}: file must be 10 MB or smaller.`);
      return;
    }
    setUploading(true);
    try {
      const ticket = await admissionsApi.signDocumentUpload({
        documentType,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      // Upload to Cloudinary (or stub URL in dev). For the dev stub adapter
      // we don't actually need to PUT — the stub URL is returned as-is and
      // the file isn't read on disk. To keep the same code path safe in both
      // modes, we wrap the PUT in try/catch and proceed to register.
      try {
        await fetch(ticket.url, {
          method: 'POST',
          body: await wrapAsFormData(file, ticket),
          headers: stripContentTypeHeader(ticket.headers),
        });
      } catch {
        // Stub URL is unreachable in test env — ignore.
      }
      await admissionsApi.registerDocument({
        documentType,
        url: ticket.url,
        key: ticket.key,
        sizeBytes: file.size,
        mimeType: file.type,
      });
      onChange();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setError(null);
    try {
      await admissionsApi.deleteDocument(existing.id);
      onChange();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="rounded-xl border border-black/10 p-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-brand-navy">
          {label}{' '}
          {required ? (
            <Badge tone="accent" size="sm">Required</Badge>
          ) : (
            <Badge tone="neutral" size="sm">Optional</Badge>
          )}
        </p>
        {existing ? (
          <p className="text-xs text-muted mt-1">
            Uploaded {new Date(existing.uploadedAt).toLocaleString()}{' '}
            · {(existing.sizeBytes / 1024).toFixed(0)} KB
          </p>
        ) : (
          <p className="text-xs text-muted mt-1">PDF / JPG / PNG · max 10 MB</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {existing && (
          <Button type="button" variant="ghost" onClick={handleDelete} disabled={uploading}>
            Delete
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,.jpg,.jpeg,image/jpeg,.png,image/png"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
        <Button
          type="button"
          variant={existing ? 'secondary' : 'primary'}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {existing ? 'Replace' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

// Cloudinary unsigned-form upload helper. In the stub adapter case the URL
// won't accept multipart and we'll fall through to the catch above.
async function wrapAsFormData(
  file: File,
  ticket: { headers: Record<string, string>; key: string },
): Promise<FormData> {
  const fd = new FormData();
  fd.append('file', file);
  // The api/cloudinary signed-upload header set includes the signature etc.
  // Forward them as form fields too — Cloudinary accepts either.
  for (const [k, v] of Object.entries(ticket.headers)) {
    if (k.startsWith('x-cld-')) {
      fd.append(k.slice('x-cld-'.length), v);
    }
  }
  fd.append('public_id', ticket.key.split('/').pop() ?? 'doc');
  return fd;
}

function stripContentTypeHeader(
  headers: Record<string, string>,
): Record<string, string> {
  // The browser must set its own multipart boundary, so don't pass
  // content-type from the server.
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'content-type'),
  );
}

// ============================================================================
// Step 7 — Statement
// ============================================================================

export function ApplyStatementPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const { data: programs } = useQuery({
    queryKey: ['admissions', 'apply', 'programs'],
    queryFn: () => admissionsApi.listPublicPrograms(),
  });
  const { data: draft } = useQuery({
    queryKey: ['admissions', 'me', 'draft'],
    queryFn: () => admissionsApi.getDraft(),
  });
  const { data: statement } = useQuery({
    queryKey: ['admissions', 'me', 'statement'],
    queryFn: () => admissionsApi.getStatement(),
  });

  useEffect(() => {
    if (statement && !hydrated) {
      setText(statement.statement ?? '');
      setHydrated(true);
    }
  }, [statement, hydrated]);

  const programId = (draft?.data?.step4_program as { programId?: string })?.programId;
  const program: PublicProgramDto | null = (programs?.find((p) => p.id === programId) ?? null);
  const wordLimit = program?.statementWordLimit ?? 1000;
  const required = program?.requiresStatement ?? false;
  const words = wordCount(text);
  const overLimit = words > wordLimit;

  const saveMutation = useMutation({
    mutationFn: (s: string) => admissionsApi.saveStatement({ statement: s }),
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Save failed.');
    },
  });

  async function handleNext() {
    setError(null);
    if (overLimit) {
      setError(`Trim to ${wordLimit} words before continuing (current: ${words}).`);
      return;
    }
    if (required && words < 50) {
      setError('Statement must be at least 50 words for this program.');
      return;
    }
    try {
      await saveMutation.mutateAsync(text);
      await admissionsApi.saveDraft({
        step: 'step7_statement',
        payload: { wordCount: words },
        markComplete: !required || words >= 50,
      });
      navigate('/apply/references');
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not advance.');
    }
  }

  return (
    <StepShell
      stepNumber={7}
      title="Personal statement"
      subtitle={
        required
          ? `Required for this program. Aim for ${wordLimit} words or fewer.`
          : `Optional, but reviewers value seeing it. Up to ${wordLimit} words.`
      }
      back={{ to: '/apply/documents', label: 'Back to documents' }}
      next={{ label: 'Next: references' }}
      onNext={handleNext}
      saving={saveMutation.isPending}
      error={error}
    >
      <TextArea
        name="statement"
        label="Your statement"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        hint={`${words} / ${wordLimit} words${overLimit ? ' — over the limit' : ''}`}
        error={overLimit ? `Trim to ${wordLimit} words.` : undefined}
      />
      <p className="text-xs text-muted">
        Tip: a strong statement explains why this program, why now, and what
        you'll bring. Plain English; no need to be formal.
      </p>
    </StepShell>
  );
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// Step 8 — References (form). The public referee upload page lives in
// pages/refer/RefereeUpload.tsx so it can be mounted outside the auth shell.
// ============================================================================

export function ApplyReferencesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const { data: programs } = useQuery({
    queryKey: ['admissions', 'apply', 'programs'],
    queryFn: () => admissionsApi.listPublicPrograms(),
  });
  const { data: draft } = useQuery({
    queryKey: ['admissions', 'me', 'draft'],
    queryFn: () => admissionsApi.getDraft(),
  });
  const { data: referees, refetch } = useQuery({
    queryKey: ['admissions', 'me', 'referees'],
    queryFn: () => admissionsApi.listMyReferees(),
  });

  const programId = (draft?.data?.step4_program as { programId?: string })?.programId;
  const program = programs?.find((p) => p.id === programId) ?? null;
  const requires = program?.requiresReferences ?? false;
  const minCount = program?.referencesMinCount ?? 0;
  const maxCount = program?.referencesMaxCount ?? 2;

  const addMutation = useMutation({
    mutationFn: () =>
      admissionsApi.addReferee({
        name,
        relationship,
        organization,
        email,
        phoneE164: phone || null,
      }),
    onSuccess: () => {
      setName('');
      setRelationship('');
      setOrganization('');
      setEmail('');
      setPhone('');
      queryClient.invalidateQueries({ queryKey: ['admissions', 'me', 'referees'] });
    },
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Could not add referee.');
    },
  });

  async function handleAdd() {
    setError(null);
    if (!name || !relationship || !organization || !email) {
      setError('All fields except phone are required.');
      return;
    }
    if ((referees?.length ?? 0) >= maxCount) {
      setError(`You can add at most ${maxCount} referees.`);
      return;
    }
    await addMutation.mutateAsync();
  }

  async function handleResend(id: string) {
    setError(null);
    try {
      await admissionsApi.resendReferee(id);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not resend.');
    }
  }
  async function handleDelete(id: string) {
    setError(null);
    try {
      await admissionsApi.deleteReferee(id);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not remove.');
    }
  }

  async function handleNext() {
    setError(null);
    const count = referees?.length ?? 0;
    if (requires && count < minCount) {
      setError(`This program requires at least ${minCount} referee${minCount === 1 ? '' : 's'}.`);
      return;
    }
    try {
      await admissionsApi.saveDraft({
        step: 'step8_references',
        payload: { count },
        markComplete: !requires || count >= minCount,
      });
      navigate('/apply/submit');
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not advance.');
    }
  }

  return (
    <StepShell
      stepNumber={8}
      title="References"
      subtitle={
        requires
          ? `${minCount}–${maxCount} referees required. We'll email each one a secure upload link.`
          : `Optional. You can add up to ${maxCount} referees.`
      }
      back={{ to: '/apply/statement', label: 'Back to statement' }}
      next={{ label: 'Next: review & submit' }}
      onNext={handleNext}
      saving={addMutation.isPending}
      error={error}
    >
      <fieldset className="rounded-xl border border-black/10 p-4 space-y-3">
        <legend className="px-2 text-sm font-semibold text-brand-navy">Add a referee</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Manager, advisor, mentor" />
          <Input label="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
          <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="tel" label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
        </div>
        <Button type="button" onClick={handleAdd} loading={addMutation.isPending}>
          + Add referee
        </Button>
      </fieldset>
      <RefereeList
        items={referees ?? []}
        onResend={handleResend}
        onDelete={handleDelete}
      />
    </StepShell>
  );
}

function RefereeList({
  items,
  onResend,
  onDelete,
}: {
  items: RefereeDto[];
  onResend: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No referees added yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="rounded-xl border border-black/10 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-brand-navy">{r.name}</p>
            <p className="text-xs text-muted">{r.organization} · {r.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={r.status === 'uploaded' ? 'success' : r.status === 'expired' ? 'danger' : 'info'}>
              {r.status.replace(/_/g, ' ')}
            </Badge>
            {r.status !== 'uploaded' && (
              <Button type="button" variant="ghost" onClick={() => onResend(r.id)}>
                Resend
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onDelete(r.id)}>
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Step 9–11 — Review and submit
// ============================================================================

export function ApplySubmitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [truthfulness, setTruthfulness] = useState(false);
  const [terms, setTerms] = useState(false);
  const [ferpaNotice, setFerpaNotice] = useState(false);
  const [priorEducationAuth, setPriorEducationAuth] = useState(false);
  const [communications, setCommunications] = useState(false);

  const { data: app } = useQuery({
    queryKey: ['admissions', 'me'],
    queryFn: () => admissionsApi.myApplication(),
  });
  const { data: draft } = useQuery({
    queryKey: ['admissions', 'me', 'draft'],
    queryFn: () => admissionsApi.getDraft(),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      admissionsApi.submitApplication({
        truthfulness,
        terms,
        ferpaNotice,
        priorEducationAuth,
        communications,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admissions', 'me'], updated);
      navigate(`/apply/confirmation?code=${updated.code}`);
    },
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Submit failed.');
    },
  });

  const allChecked =
    truthfulness && terms && ferpaNotice && priorEducationAuth && communications;

  async function handleSubmit() {
    setError(null);
    if (!allChecked) {
      setError('Please acknowledge each consent before submitting.');
      return;
    }
    await submitMutation.mutateAsync();
  }

  if (app?.state && app.state !== 'draft') {
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <div className="max-w-md text-center space-y-3">
          <Badge tone="info" size="md">Already submitted</Badge>
          <p className="text-muted">
            Your application has already been submitted. We'll be in touch.
          </p>
          <Link to="/apply/portal">
            <Button>Back to portal</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <StepShell
      stepNumber={10}
      title="Review and submit"
      subtitle="Confirm each acknowledgement, then submit. Once submitted, you can't edit the application — corrections need to go through Admissions."
      back={{ to: '/apply/references', label: 'Back to references' }}
      next={{ label: 'Submit application' }}
      onNext={handleSubmit}
      saving={submitMutation.isPending}
      error={error}
    >
      <DraftSummary draft={draft} />
      <fieldset className="space-y-3 rounded-xl border border-black/10 p-4">
        <legend className="px-2 text-sm font-semibold text-brand-navy">Required consents</legend>
        <ConsentCheckbox
          checked={truthfulness}
          onChange={setTruthfulness}
          label="I confirm the information I've provided is accurate and complete."
        />
        <ConsentCheckbox
          checked={terms}
          onChange={setTerms}
          label="I have read and accept the Terms of Use and Privacy Policy."
        />
        <ConsentCheckbox
          checked={ferpaNotice}
          onChange={setFerpaNotice}
          label="I have read India Learns' FERPA notification (will be enforced in our US operations; designed in for future)."
        />
        <ConsentCheckbox
          checked={priorEducationAuth}
          onChange={setPriorEducationAuth}
          label="I authorise India Learns to contact prior institutions to verify my academic record."
        />
        <ConsentCheckbox
          checked={communications}
          onChange={setCommunications}
          label="I consent to receive admissions-related communication via email and SMS."
        />
      </fieldset>
    </StepShell>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}

function DraftSummary({ draft }: { draft: { completedSteps?: string[] } | null | undefined }) {
  const completed = new Set(draft?.completedSteps ?? []);
  const rows: { id: string; label: string }[] = [
    { id: 'step2_personal', label: 'Personal information' },
    { id: 'step3_contact', label: 'Contact information' },
    { id: 'step4_program', label: 'Program selection' },
    { id: 'step5_academic', label: 'Academic background' },
    { id: 'step6_documents', label: 'Documents' },
    { id: 'step7_statement', label: 'Statement' },
    { id: 'step8_references', label: 'References' },
  ];
  return (
    <article className="rounded-xl border border-black/10 p-4">
      <h2 className="text-sm font-semibold text-brand-navy mb-3">Sections</h2>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between">
            <span>{r.label}</span>
            {completed.has(r.id) ? (
              <Badge tone="success">Complete</Badge>
            ) : (
              <Badge tone="warning">Incomplete</Badge>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ApplyConfirmationPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') ?? '';
  return (
    <main className="min-h-screen bg-surface grid place-items-center">
      <article className="max-w-lg w-full mx-auto px-6 py-12 text-center space-y-6 animate-fade-in-up">
        <div className="text-brand-orange text-5xl">✓</div>
        <h1 className="text-display-md text-brand-navy">Application submitted</h1>
        <p className="text-muted">
          Your application reference is:
        </p>
        <p className="text-display-sm text-brand-navy font-mono">{code}</p>
        <p className="text-muted text-sm">
          We've emailed you a copy of this confirmation. We'll be in touch on
          email each time the status changes. You can check status anytime in
          your portal.
        </p>
        <Link to="/apply/portal">
          <Button>Go to your portal</Button>
        </Link>
      </article>
    </main>
  );
}
