import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  VISITOR_LEAD_SOURCES,
  VISITOR_LEAD_STATUSES,
  VISITOR_OTP_STATUSES,
  VISITOR_QUALIFICATIONS,
  type VisitorLeadDto,
  type VisitorLeadSource,
  type VisitorLeadStatus,
  type VisitorOtpStatus,
  type VisitorQualification,
} from 'india-learns-shared-types';
import { visitorLeadsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { ApiHttpError } from '../../lib/api.js';
import { normalizePhoneLoose, PHONE_HINT } from '../../lib/phone.js';

// M10s — Visitor Leads list + create/edit. Pre-application funnel.
// Admin / superadmin only. On Convert (future PR), prefills /apply.

const QUALIFICATION_LABEL: Record<VisitorQualification, string> = {
  high_school: 'High School',
  bba: 'BBA',
  btech: 'B.Tech',
  graduate: 'Graduate',
  other: 'Other',
};

const SOURCE_LABEL: Record<VisitorLeadSource, string> = {
  reference: 'Reference',
  google: 'Google',
  social_media: 'Social Media',
  walk_in: 'Walk-in',
  meta: 'Meta (FB/IG ads)',
  agent: 'Agent',
  other: 'Other',
};

const STATUS_LABEL: Record<VisitorLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  dropped: 'Dropped',
};

const STATUS_TONE: Record<
  VisitorLeadStatus,
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'
> = {
  new: 'info',
  contacted: 'accent',
  qualified: 'success',
  converted: 'success',
  dropped: 'neutral',
};

export function AdminVisitorLeadsPage() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<VisitorLeadStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<VisitorLeadSource | ''>('');
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin', 'visitor-leads', { q, statusFilter, sourceFilter }],
    queryFn: () =>
      visitorLeadsApi.list({
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        leadSource: sourceFilter || undefined,
      }),
  });

  const editingLead = editingId
    ? listQ.data?.items.find((l) => l.id === editingId) ?? null
    : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Admissions funnel"
        title="Visitor Leads"
        subtitle="Prospects captured by admin / admissions staff. Walk-ins, agent referrals, social inbound. Convert qualified leads into applicants when they're ready."
        action={
          <Button onClick={() => { setShowNew((s) => !s); setEditingId(null); }}>
            {showNew ? 'Close' : 'Add lead'}
          </Button>
        }
      />

      {showNew && (
        <LeadForm
          onCancel={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            qc.invalidateQueries({ queryKey: ['admin', 'visitor-leads'] });
          }}
        />
      )}

      {editingLead && (
        <LeadForm
          lead={editingLead}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ['admin', 'visitor-leads'] });
          }}
        />
      )}

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone…"
            className="min-w-[220px]"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VisitorLeadStatus | '')}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">All</option>
              {VISITOR_LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Source</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as VisitorLeadSource | '')}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">All</option>
              {VISITOR_LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        {listQ.isLoading && <Skeleton lines={5} />}
        {listQ.isError && (
          <ErrorAlert
            message={(listQ.error as Error).message}
            onRetry={() => listQ.refetch()}
          />
        )}
        {listQ.data && listQ.data.items.length === 0 && (
          <EmptyState title="No leads yet" message="Click “Add lead” to capture your first prospect." />
        )}
        {listQ.data && listQ.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">OTP</th>
                  <th className="py-2 pr-3">Captured</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {listQ.data.items.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-brand-navy">
                        {lead.firstName} {lead.lastName}
                      </p>
                      {lead.email && (
                        <p className="text-xs text-muted">{lead.email}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{lead.phoneE164}</td>
                    <td className="py-2.5 pr-3">{SOURCE_LABEL[lead.leadSource]}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={STATUS_TONE[lead.status]} dot size="sm">
                        {STATUS_LABEL[lead.status]}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        tone={lead.otpVerificationStatus === 'verified' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {lead.otpVerificationStatus}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <Button size="sm" onClick={() => { setEditingId(lead.id); setShowNew(false); }}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LeadForm({
  lead,
  onCancel,
  onSaved,
}: {
  lead?: VisitorLeadDto;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState(lead?.firstName ?? '');
  const [lastName, setLastName] = useState(lead?.lastName ?? '');
  const [phone, setPhone] = useState(lead?.phoneE164 ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [qualification, setQualification] = useState<VisitorQualification | ''>(
    lead?.highestQualification ?? '',
  );
  const [dob, setDob] = useState(lead?.dateOfBirth ?? '');
  const [parentContact, setParentContact] = useState(lead?.parentGuardianContact ?? '');
  const [source, setSource] = useState<VisitorLeadSource>(lead?.leadSource ?? 'walk_in');
  const [socialId, setSocialId] = useState(lead?.socialMediaId ?? '');
  const [status, setStatus] = useState<VisitorLeadStatus>(lead?.status ?? 'new');
  const [otpStatus, setOtpStatus] = useState<VisitorOtpStatus>(
    lead?.otpVerificationStatus ?? 'pending',
  );
  const [notes, setNotes] = useState(lead?.notes ?? '');
  // Address sub-fields:
  const [street, setStreet] = useState(lead?.currentAddress?.street ?? '');
  const [city, setCity] = useState(lead?.currentAddress?.city ?? '');
  const [stateProvince, setStateProvince] = useState(lead?.currentAddress?.stateProvince ?? '');
  const [postal, setPostal] = useState(lead?.currentAddress?.postalCode ?? '');
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(lead);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneE164: normalizePhoneLoose(phone) ?? phone.trim(),
        email: email.trim() || null,
        highestQualification: (qualification || null) as VisitorQualification | null,
        dateOfBirth: dob.trim() || null,
        parentGuardianContact: parentContact.trim() || null,
        leadSource: source,
        socialMediaId: socialId.trim() || null,
        status,
        otpVerificationStatus: otpStatus,
        notes: notes.trim() || null,
        currentAddress:
          street.trim() || city.trim() || stateProvince.trim() || postal.trim()
            ? {
                street: street.trim(),
                city: city.trim(),
                stateProvince: stateProvince.trim(),
                postalCode: postal.trim(),
                country: 'India',
              }
            : null,
      };
      return isEdit
        ? visitorLeadsApi.update(lead!.id, payload)
        : visitorLeadsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'visitor-leads'] });
      onSaved();
    },
    onError: (err) =>
      setError(err instanceof ApiHttpError ? err.message : 'Failed to save lead.'),
  });

  const remove = useMutation({
    mutationFn: () => visitorLeadsApi.remove(lead!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'visitor-leads'] });
      onSaved();
    },
    onError: (err) =>
      setError(err instanceof ApiHttpError ? err.message : 'Failed to delete lead.'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <Card>
      <CardHeader
        title={isEdit ? 'Edit lead' : 'New visitor lead'}
        subtitle="Capture the prospect's details. Mark OTP Verified after you've confirmed by phone."
      />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            hint={PHONE_HINT}
            required
          />
          <Input
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prospect@example.com"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Highest qualification
            </span>
            <select
              value={qualification}
              onChange={(e) => setQualification(e.target.value as VisitorQualification | '')}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">— Select —</option>
              {VISITOR_QUALIFICATIONS.map((qv) => (
                <option key={qv} value={qv}>
                  {QUALIFICATION_LABEL[qv]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Date of birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <Input
            label="Parent / guardian contact"
            value={parentContact}
            onChange={(e) => setParentContact(e.target.value)}
            placeholder="Name + phone"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Lead source
            </span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as VisitorLeadSource)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {VISITOR_LEAD_SOURCES.map((sv) => (
                <option key={sv} value={sv}>
                  {SOURCE_LABEL[sv]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Social media handle / link"
            value={socialId}
            onChange={(e) => setSocialId(e.target.value)}
            placeholder="@handle or full URL"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VisitorLeadStatus)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {VISITOR_LEAD_STATUSES.map((sv) => (
                <option key={sv} value={sv}>
                  {STATUS_LABEL[sv]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              OTP verification
            </span>
            <select
              value={otpStatus}
              onChange={(e) => setOtpStatus(e.target.value as VisitorOtpStatus)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {VISITOR_OTP_STATUSES.map((sv) => (
                <option key={sv} value={sv}>
                  {sv === 'pending' ? 'Pending' : 'Verified'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="border border-black/5 rounded-xl p-3">
          <legend className="text-xs uppercase tracking-wider text-muted font-bold px-1">
            Current address
          </legend>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <Input label="Street" value={street} onChange={(e) => setStreet(e.target.value)} />
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input
              label="State"
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
            />
            <Input
              label="Pin code"
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
            />
          </div>
        </fieldset>

        <TextArea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Conversation notes, next-step, callback time…"
        />

        {error && (
          <div role="alert" className="rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create lead'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (confirm('Delete this lead? They can still be re-captured by phone number.')) {
                  remove.mutate();
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
