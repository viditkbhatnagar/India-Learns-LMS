import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplicationDecisionInput,
  ApplicationDocumentDto,
  OfficerApplicationDetailDto,
  RefereeDto,
  ReviewerNoteDto,
} from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { FileLink } from '../../components/FileLink.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { admissionsApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

// M5 — Officer-facing application detail. Sections: header, applicant info,
// program & cohort, documents, statement, references, notes, decision
// toolbar. Audit-chain is its own collapsible at the bottom.

export function AdmissionsApplicationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admissions', 'officer', 'application', id],
    queryFn: () => admissionsApi.getForOfficer(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <p className="text-muted">Loading application…</p>;
  }
  if (isError || !data) {
    return (
      <article className="rounded-2xl bg-white p-6 border border-black/5">
        <p className="text-danger">Could not load this application.</p>
        <Link to="/admissions/dashboard" className="text-brand-navy underline">
          ← Back to dashboard
        </Link>
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admissions"
        title={`Application ${data.code}`}
        subtitle={`${data.applicantName || 'Applicant'} · ${data.applicantEmail}`}
        back={{ to: '/admissions/dashboard', label: 'All applications' }}
        action={<DecisionToolbar app={data} onChange={() => queryClient.invalidateQueries({ queryKey: ['admissions', 'officer', 'application', id] })} setError={setError} />}
      />

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Applicant">
            <SectionRow label="Name" value={data.applicantName || '—'} />
            <SectionRow label="Email" value={data.applicantEmail} />
            <SectionRow label="Application code" value={data.code} mono />
            <SectionRow label="Current state" value={<Badge tone="info">{data.state.replace(/_/g, ' ')}</Badge>} />
            {data.submittedAt && (
              <SectionRow label="Submitted at" value={new Date(data.submittedAt).toLocaleString()} />
            )}
          </Section>

          <DraftSections draft={data.draft} />

          {data.statement && (
            <Section title="Personal statement">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.statement}</p>
            </Section>
          )}

          <Section title={`Documents (${data.documents.length})`}>
            <DocumentsList items={data.documents} />
          </Section>

          <Section title={`Referees (${data.referees.length})`}>
            <RefereeListPanel items={data.referees} />
          </Section>

          {data.consents && (
            <Section title="Consents">
              <ConsentRow label="Truthfulness" c={data.consents.truthfulness} />
              <ConsentRow label="Terms & privacy" c={data.consents.terms} />
              <ConsentRow label="FERPA notice" c={data.consents.ferpaNotice} />
              <ConsentRow label="Prior education auth" c={data.consents.priorEducationAuth} />
              <ConsentRow label="Communications" c={data.consents.communications} />
            </Section>
          )}

          {data.fee && (
            <FeeSection
              applicationId={id}
              fee={data.fee}
              onChange={() => queryClient.invalidateQueries({ queryKey: ['admissions', 'officer', 'application', id] })}
              setError={setError}
            />
          )}
        </div>

        <aside className="space-y-6">
          <NotesPanel
            applicationId={id}
            notes={data.notes}
            onAdd={() => queryClient.invalidateQueries({ queryKey: ['admissions', 'officer', 'application', id] })}
            setError={setError}
          />
          <AuditPanel applicationId={id} />
        </aside>
      </div>

      <div className="text-center">
        <Button variant="ghost" onClick={() => navigate('/admissions/dashboard')}>
          ← Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow-elev-1 border border-black/5">
      <header className="px-5 py-3 border-b border-black/5">
        <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
      </header>
      <div className="p-5 space-y-3">{children}</div>
    </section>
  );
}

function SectionRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-mono text-brand-navy' : 'text-ink'}>{value}</span>
    </div>
  );
}

function ConsentRow({ label, c }: { label: string; c: { acknowledged: boolean; atUtc: string | null; version: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {c.acknowledged ? (
          <Badge tone="success">Acknowledged</Badge>
        ) : (
          <Badge tone="warning">Pending</Badge>
        )}
        <span className="text-muted text-xs">
          {c.atUtc ? new Date(c.atUtc).toLocaleString() : '—'} · {c.version}
        </span>
      </span>
    </div>
  );
}

function DraftSections({ draft }: { draft: OfficerApplicationDetailDto['draft'] }) {
  if (!draft) return null;
  const {data} = draft;
  const step2 = data.step2_personal as Record<string, string> | undefined;
  const step3 = data.step3_contact as
    | { address?: Record<string, string>; mobilePhoneE164?: string; emergency?: Record<string, string> }
    | undefined;
  const step4 = data.step4_program as Record<string, string> | undefined;
  const step5 = data.step5_academic as
    | Array<Record<string, string | null>>
    | undefined;

  return (
    <>
      <Section title="Personal">
        <SectionRow label="Legal name" value={`${step2?.legalFirstName ?? '—'} ${step2?.legalLastName ?? ''}`.trim()} />
        <SectionRow label="Preferred name" value={step2?.preferredName ?? '—'} />
        <SectionRow label="Date of birth" value={step2?.dateOfBirthIst ?? '—'} />
        <SectionRow label="Citizenship" value={step2?.citizenship ?? '—'} />
        <SectionRow label="Primary language" value={step2?.primaryLanguage ?? '—'} />
      </Section>
      <Section title="Contact">
        <SectionRow
          label="Address"
          value={
            step3?.address
              ? `${step3.address.street ?? ''}, ${step3.address.city ?? ''}, ${step3.address.stateProvince ?? ''} ${step3.address.postalCode ?? ''}, ${step3.address.country ?? ''}`
              : '—'
          }
        />
        <SectionRow label="Mobile" value={step3?.mobilePhoneE164 ?? '—'} mono />
        <SectionRow
          label="Emergency contact"
          value={
            step3?.emergency
              ? `${step3.emergency.name ?? ''} (${step3.emergency.relationship ?? '—'}) · ${step3.emergency.phoneE164 ?? '—'}`
              : '—'
          }
        />
      </Section>
      <Section title="Program">
        <SectionRow label="Program" value={step4?.programId ?? '—'} mono />
        <SectionRow label="Cohort" value={step4?.batchId ?? '— (officer-assigned)'} mono />
        <SectionRow label="Intended start" value={step4?.intendedStartTerm ?? '—'} />
        <SectionRow label="Mode of study" value={step4?.modeOfStudy ?? '—'} />
        <SectionRow label="Full / part-time" value={step4?.fullPartTime ?? '—'} />
      </Section>
      <Section title={`Academic background (${step5?.length ?? 0})`}>
        {!step5 || step5.length === 0 ? (
          <p className="text-sm text-muted">No entries.</p>
        ) : (
          <ol className="space-y-3">
            {step5.map((entry, idx) => (
               
              <li key={idx} className="rounded-lg border border-black/5 p-3 text-sm">
                <p className="font-semibold">{entry.institutionName ?? `Institution ${idx + 1}`}</p>
                <p className="text-muted text-xs">
                  {entry.country ?? '—'} · {entry.fromDate ?? '—'} → {entry.toDate ?? 'present'}
                </p>
                {entry.credentialEarned && <p className="text-xs mt-1">Credential: {entry.credentialEarned}</p>}
                {entry.gpaOrEquivalent && <p className="text-xs">GPA: {entry.gpaOrEquivalent}</p>}
                {entry.standardizedTestScores && <p className="text-xs">Tests: {entry.standardizedTestScores}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

function DocumentsList({ items }: { items: ApplicationDocumentDto[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No documents uploaded.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li key={d.id} className="flex items-center justify-between text-sm gap-3">
          <div>
            <p className="font-semibold">{d.label}</p>
            <p className="text-muted text-xs">
              {d.mimeType} · {(d.sizeBytes / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString()}{' '}
              {d.uploadedByRole === 'referee' && <Badge tone="info" size="sm">Referee</Badge>}
            </p>
          </div>
          <FileLink url={d.url} className="text-brand-navy underline">
            View
          </FileLink>
        </li>
      ))}
    </ul>
  );
}

function RefereeListPanel({ items }: { items: RefereeDto[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">No referees.</p>;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} className="flex items-center justify-between text-sm gap-3">
          <div>
            <p className="font-semibold">{r.name}</p>
            <p className="text-muted text-xs">{r.relationship} at {r.organization} · {r.email}</p>
          </div>
          <Badge tone={r.status === 'uploaded' ? 'success' : r.status === 'expired' ? 'danger' : 'info'}>
            {r.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function NotesPanel({
  applicationId,
  notes,
  onAdd,
  setError,
}: {
  applicationId: string;
  notes: ReviewerNoteDto[];
  onAdd: () => void;
  setError: (msg: string | null) => void;
}) {
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => admissionsApi.addOfficerNote(applicationId, { body }),
    onSuccess: () => {
      setBody('');
      onAdd();
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Could not add note.'),
  });
  return (
    <section className="rounded-2xl bg-white shadow-elev-1 border border-black/5">
      <header className="px-5 py-3 border-b border-black/5">
        <h2 className="text-sm font-semibold text-brand-navy">Reviewer notes ({notes.length})</h2>
      </header>
      <div className="p-5 space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="text-xs text-muted">
                  {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <TextArea
          label="Add a note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          name="reviewer-note"
        />
        <Button
          type="button"
          size="sm"
          loading={m.isPending}
          disabled={!body.trim()}
          onClick={() => m.mutate()}
        >
          Save note
        </Button>
      </div>
    </section>
  );
}

function DecisionToolbar({
  app,
  onChange,
  setError,
}: {
  app: OfficerApplicationDetailDto;
  onChange: () => void;
  setError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState<ApplicationDecisionInput['decision'] | null>(null);
  const [reasonApplicant, setReasonApplicant] = useState('');
  const [reasonInternal, setReasonInternal] = useState('');

  const m = useMutation({
    mutationFn: (input: ApplicationDecisionInput) => admissionsApi.recordDecision(app.id, input),
    onSuccess: () => {
      setOpen(null);
      setReasonApplicant('');
      setReasonInternal('');
      onChange();
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Decision failed.'),
  });

  const terminal = ['admitted', 'denied', 'withdrawn'].includes(app.state);
  if (terminal) {
    return <Badge tone="info" size="md">Decision: {app.state.replace(/_/g, ' ')}</Badge>;
  }
  const allowDecide = ['submitted', 'under_review', 'decision_pending'].includes(app.state);
  if (!allowDecide) {
    return <Badge tone="warning" size="md">Awaiting submission</Badge>;
  }
  if (open) {
    return (
      <div className="rounded-xl bg-white border border-black/10 p-4 shadow-elev-2 w-full sm:w-[420px]">
        <p className="text-sm font-semibold text-brand-navy mb-2">
          {open === 'admit' ? 'Admit applicant' : open === 'deny' ? 'Deny application' : 'Place on waitlist'}
        </p>
        <Input
          name="reasonApplicant"
          label="Message to applicant (optional)"
          value={reasonApplicant}
          onChange={(e) => setReasonApplicant(e.target.value)}
        />
        <Input
          name="reasonInternal"
          label="Internal note (optional, not shared)"
          value={reasonInternal}
          onChange={(e) => setReasonInternal(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(null)} disabled={m.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={open === 'admit' ? 'primary' : open === 'deny' ? 'danger' : 'secondary'}
            loading={m.isPending}
            onClick={() =>
              m.mutate({
                decision: open,
                reasonApplicant: reasonApplicant || undefined,
                reasonInternal: reasonInternal || undefined,
              })
            }
          >
            Confirm {open}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" onClick={() => setOpen('waitlist')}>
        Waitlist
      </Button>
      <Button type="button" variant="danger" onClick={() => setOpen('deny')}>
        Deny
      </Button>
      <Button type="button" onClick={() => setOpen('admit')}>
        Admit
      </Button>
    </div>
  );
}

function FeeSection({
  applicationId,
  fee,
  onChange,
  setError,
}: {
  applicationId: string;
  fee: NonNullable<OfficerApplicationDetailDto['fee']>;
  onChange: () => void;
  setError: (msg: string | null) => void;
}) {
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(String(Math.round(fee.amountPaise / 100)));
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'>('upi');
  const [reference, setReference] = useState('');

  const waive = useMutation({
    mutationFn: () => admissionsApi.waiveApplicationFee(applicationId, { reason }),
    onSuccess: () => {
      setWaiveOpen(false);
      setReason('');
      onChange();
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Waive failed.'),
  });
  const record = useMutation({
    mutationFn: () =>
      admissionsApi.recordApplicationPayment(applicationId, {
        amountPaise: Math.round(Number(amount) * 100),
        method,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      setRecordOpen(false);
      onChange();
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Record failed.'),
  });

  const toneByStatus: Record<typeof fee.status, 'success' | 'warning' | 'info'> = {
    paid: 'success',
    waived: 'info',
    pending: 'warning',
  };

  return (
    <section className="rounded-2xl bg-white shadow-elev-1 border border-black/5">
      <header className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Application fee</h2>
        <Badge tone={toneByStatus[fee.status]}>{fee.status}</Badge>
      </header>
      <div className="p-5 space-y-3 text-sm">
        <div>
          <span className="text-muted">Amount: </span>
          <span className="font-semibold text-brand-navy">₹{(fee.amountPaise / 100).toFixed(0)}</span>
        </div>
        {fee.status === 'paid' && fee.paidAt && (
          <p className="text-xs text-muted">Recorded at {new Date(fee.paidAt).toLocaleString()}</p>
        )}
        {fee.status === 'waived' && (
          <p className="text-xs text-muted">
            Waived{fee.waivedAt ? ` at ${new Date(fee.waivedAt).toLocaleString()}` : ''}
            {fee.waivedReason ? ` — ${fee.waivedReason}` : ''}
          </p>
        )}
        {fee.status === 'pending' && fee.amountPaise > 0 && (
          <p className="text-xs text-warning">
            Admit is blocked until the fee is recorded or waived.
          </p>
        )}

        {recordOpen ? (
          <div className="space-y-2 rounded-lg border border-black/10 p-3">
            <p className="text-xs font-semibold text-brand-navy">Record payment</p>
            <Input
              type="number"
              min="0"
              label="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <label className="block">
              <span className="block text-sm font-semibold text-brand-navy mb-1.5">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>
            <Input
              label="Reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / cheque no / etc"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setRecordOpen(false)} disabled={record.isPending}>
                Cancel
              </Button>
              <Button onClick={() => record.mutate()} loading={record.isPending}>
                Record payment
              </Button>
            </div>
          </div>
        ) : waiveOpen ? (
          <div className="space-y-2 rounded-lg border border-black/10 p-3">
            <p className="text-xs font-semibold text-brand-navy">Waive fee</p>
            <Input
              label="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Scholarship, hardship, etc."
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setWaiveOpen(false)} disabled={waive.isPending}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => waive.mutate()} loading={waive.isPending} disabled={!reason.trim()}>
                Waive
              </Button>
            </div>
          </div>
        ) : (
          fee.status === 'pending' && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setRecordOpen(true)}>
                Record payment
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWaiveOpen(true)}>
                Waive
              </Button>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function AuditPanel({ applicationId }: { applicationId: string }) {
  const { data } = useQuery({
    queryKey: ['admissions', 'officer', 'audit', applicationId],
    queryFn: () => admissionsApi.getAuditChain(applicationId),
  });
  return (
    <section className="rounded-2xl bg-white shadow-elev-1 border border-black/5">
      <header className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Audit chain</h2>
        {data && (
          <Badge tone={data.verified ? 'success' : 'danger'}>
            {data.verified ? 'Verified' : 'Tampered'}
          </Badge>
        )}
      </header>
      <div className="p-5 space-y-2">
        {!data || data.entries.length === 0 ? (
          <p className="text-sm text-muted">No audit entries yet.</p>
        ) : (
          <ol className="space-y-2 text-xs">
            {data.entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-black/5 p-2">
                <p className="font-semibold text-brand-navy">{e.action}</p>
                <p className="text-muted">{new Date(e.at).toLocaleString()}</p>
                <p className="text-muted font-mono break-all">…{e.chainHash.slice(-12)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
