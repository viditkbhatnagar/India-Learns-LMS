import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  JOB_APPLICATION_STATUSES,
  JOB_EMPLOYMENT_TYPES,
  JOB_POSTING_STATES,
  type CompanyDto,
  type JobApplicationDto,
  type JobApplicationStatus,
  type JobEmploymentType,
  type JobPostingState,
} from 'india-learns-shared-types';
import { placementApi } from '../lib/endpoints.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Input, TextArea } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../components/ui/States.js';
import { PageHeader } from '../components/ui/PageHeader.js';

// M10f — Admin placement console (LMS_Requirements §3).
//
// Three tabs in one screen: Postings (CRUD + drill-in to applications),
// Companies (CRUD), Analytics (numeric rollup). Intentionally
// information-dense; the admin team will spend time here.

type Tab = 'postings' | 'companies' | 'analytics';

const TAB_LABEL: Record<Tab, string> = {
  postings: 'Job postings',
  companies: 'Companies',
  analytics: 'Analytics',
};

const STATUS_TONES: Record<JobApplicationStatus, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'accent'> = {
  applied: 'info',
  shortlisted: 'accent',
  interview_scheduled: 'warning',
  selected: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

const POSTING_TONES: Record<JobPostingState, 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  published: 'success',
  closed: 'warning',
};

export function AdminPlacementPage() {
  const [tab, setTab] = useState<Tab>('postings');
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Placement"
        subtitle="Post jobs, track applications, and review the placement funnel."
      />
      <div className="flex flex-wrap gap-2" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t
                ? 'bg-brand-navy text-white shadow-elev-2'
                : 'bg-white border border-black/5 text-brand-navy hover:border-brand-navy/30'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === 'postings' && <PostingsTab />}
      {tab === 'companies' && <CompaniesTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

function PostingsTab() {
  const qc = useQueryClient();
  const postingsQ = useQuery({
    queryKey: ['placement', 'postings'],
    queryFn: () => placementApi.listJobs(),
  });
  const companiesQ = useQuery({
    queryKey: ['placement', 'companies'],
    queryFn: () => placementApi.listCompanies(),
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {postingsQ.data?.length ?? 0} posting{postingsQ.data?.length === 1 ? '' : 's'} ·{' '}
          {postingsQ.data?.filter((p) => p.state === 'published').length ?? 0} published
        </p>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'New posting'}
        </Button>
      </div>
      {showForm && companiesQ.data && (
        <CreatePostingForm
          companies={companiesQ.data}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['placement', 'postings'] });
            setShowForm(false);
          }}
        />
      )}
      {postingsQ.isLoading && <Skeleton lines={4} />}
      {postingsQ.isError && (
        <ErrorAlert
          message={(postingsQ.error as Error).message}
          onRetry={() => postingsQ.refetch()}
        />
      )}
      {postingsQ.data?.length === 0 && (
        <EmptyState
          title="No postings yet"
          message="Add a company in the Companies tab first, then post a job here."
        />
      )}
      {postingsQ.data && postingsQ.data.length > 0 && (
        <Card>
          <ul className="divide-y divide-black/5">
            {postingsQ.data.map((p) => (
              <li
                key={p.id}
                className="py-4 flex items-center justify-between gap-4 group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-brand-navy truncate">{p.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {p.companyName ?? 'Company'} · {p.location || 'Remote'} ·{' '}
                    <span className="capitalize">
                      {p.employmentType.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={POSTING_TONES[p.state]} dot>
                    {p.state}
                  </Badge>
                  <span className="text-xs text-muted">
                    {p.applicantCount} applicant{p.applicantCount === 1 ? '' : 's'}
                  </span>
                  <Button
                    onClick={() =>
                      setSelectedPostingId(selectedPostingId === p.id ? null : p.id)
                    }
                  >
                    {selectedPostingId === p.id ? 'Hide' : 'Manage'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {selectedPostingId && (
        <PostingDetail
          postingId={selectedPostingId}
          onUpdated={() =>
            qc.invalidateQueries({ queryKey: ['placement', 'postings'] })
          }
        />
      )}
    </div>
  );
}

function CreatePostingForm({
  companies,
  onCreated,
}: {
  companies: CompanyDto[];
  onCreated: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<JobEmploymentType>('full_time');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: () =>
      placementApi.createJob({
        companyId,
        title,
        description,
        location,
        employmentType,
        applicationDeadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    onSuccess: onCreated,
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create.'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutate.mutate();
  }

  return (
    <Card>
      <CardHeader title="New posting" subtitle="Create as a draft; publish from the posting detail." />
      <form onSubmit={submit} className="space-y-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted font-bold">Company</span>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
            className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Type</span>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as JobEmploymentType)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {JOB_EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Apply deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        {error && (
          <div role="alert" className="rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger">
            {error}
          </div>
        )}
        <Button type="submit" loading={mutate.isPending}>
          Create posting
        </Button>
      </form>
    </Card>
  );
}

function PostingDetail({
  postingId,
  onUpdated,
}: {
  postingId: string;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  // M10p — Inline scheduler modal state. `null` = closed. Set to a
  // JobApplicationDto to open the modal with that application's current
  // interviewAt / interviewLocation pre-filled.
  const [schedulingApp, setSchedulingApp] =
    useState<JobApplicationDto | null>(null);
  const postingQ = useQuery({
    queryKey: ['placement', 'postings', postingId],
    queryFn: () => placementApi.getJob(postingId),
  });
  const appsQ = useQuery({
    queryKey: ['placement', 'postings', postingId, 'apps'],
    queryFn: () => placementApi.listApplicationsForJob(postingId),
  });
  const setState = useMutation({
    mutationFn: (state: JobPostingState) =>
      placementApi.updateJob(postingId, { state }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['placement', 'postings', postingId] });
      onUpdated();
    },
  });
  const setStatus = useMutation({
    mutationFn: ({
      id,
      status,
      interviewAt,
      interviewLocation,
    }: {
      id: string;
      status: JobApplicationStatus;
      interviewAt?: string | null;
      interviewLocation?: string | null;
    }) =>
      placementApi.updateApplicationStatus(id, {
        status,
        interviewAt,
        interviewLocation,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['placement', 'postings', postingId, 'apps'] }),
  });

  if (postingQ.isLoading) return <Skeleton lines={3} />;
  if (postingQ.isError)
    return (
      <ErrorAlert
        message={(postingQ.error as Error).message}
        onRetry={() => postingQ.refetch()}
      />
    );
  const p = postingQ.data;
  if (!p) return null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-brand-navy">{p.title}</h3>
          <p className="text-sm text-muted">{p.description}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {JOB_POSTING_STATES.filter((s) => s !== p.state).map((s) => (
            <Button key={s} onClick={() => setState.mutate(s)}>
              {s === 'published' ? 'Publish' : s === 'closed' ? 'Close' : 'Move to draft'}
            </Button>
          ))}
        </div>
      </div>
      <h4 className="text-sm font-bold text-brand-navy mb-2">
        Applications ({appsQ.data?.length ?? 0})
      </h4>
      {appsQ.isLoading && <Skeleton lines={2} />}
      {appsQ.data?.length === 0 && (
        <EmptyState title="No applications yet" message="" />
      )}
      {appsQ.data && appsQ.data.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">Applied</th>
                <th className="py-2 pr-3">Resume</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Set status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {appsQ.data.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{a.studentCode ?? '—'}</td>
                  <td className="py-2 pr-3 font-medium text-brand-navy">
                    {a.studentName ?? '(unknown)'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted">
                    {new Date(a.appliedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-2 pr-3">
                    {a.resumeUrl ? (
                      <a
                        href={a.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-orange hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={STATUS_TONES[a.status]} dot size="sm">
                      {a.status.replace('_', ' ')}
                    </Badge>
                    {/* M10l — Interview schedule shown inline when set */}
                    {a.status === 'interview_scheduled' && a.interviewAt && (
                      <p className="text-[10px] text-muted mt-1">
                        {new Date(a.interviewAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {a.interviewLocation && ` · ${a.interviewLocation}`}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={a.status}
                      onChange={(e) => {
                        const next = e.target.value as JobApplicationStatus;
                        // M10p — When flipping TO interview_scheduled,
                        // open the InterviewSchedulerModal so the admin
                        // can pick date + location in a proper form.
                        if (next === 'interview_scheduled') {
                          setSchedulingApp(a);
                          return;
                        }
                        setStatus.mutate({ id: a.id, status: next });
                      }}
                      className="rounded-lg border border-black/10 px-2 py-1.5 bg-white text-xs"
                    >
                      {JOB_APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    {a.status === 'interview_scheduled' && (
                      <button
                        type="button"
                        onClick={() => setSchedulingApp(a)}
                        className="block mt-1 text-[10px] text-brand-orange hover:underline"
                      >
                        Edit schedule
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* M10p — Interview scheduler modal. Mounted at the bottom of
          PostingDetail so it lives within the table state. Save calls the
          same setStatus mutation with interviewAt + interviewLocation. */}
      {schedulingApp && (
        <InterviewSchedulerModal
          app={schedulingApp}
          onClose={() => setSchedulingApp(null)}
          onSave={(payload) => {
            setStatus.mutate({
              id: schedulingApp.id,
              status: 'interview_scheduled',
              interviewAt: payload.interviewAt,
              interviewLocation: payload.interviewLocation,
            });
            setSchedulingApp(null);
          }}
        />
      )}
    </Card>
  );
}

// M10p — Modal for scheduling an interview (date + time + location).
// Replaces the two window.prompt calls that previously gathered this
// info. Renders as a fixed overlay; close-on-backdrop + Esc + Cancel.
function InterviewSchedulerModal({
  app,
  onClose,
  onSave,
}: {
  app: JobApplicationDto;
  onClose: () => void;
  onSave: (payload: { interviewAt: string; interviewLocation: string | null }) => void;
}) {
  const defaultLocal = app.interviewAt
    ? // Format an ISO into the YYYY-MM-DDTHH:mm shape the datetime-local
      // input expects, in the browser's local timezone (matches how
      // admins think about the interview slot).
      new Date(app.interviewAt).toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16)
    : '';
  const [when, setWhen] = useState<string>(defaultLocal);
  const [location, setLocation] = useState<string>(app.interviewLocation ?? '');
  const [err, setErr] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!when) {
      setErr('Pick a date and time.');
      return;
    }
    const iso = new Date(when).toISOString();
    if (Number.isNaN(new Date(when).getTime())) {
      setErr('Date is invalid.');
      return;
    }
    onSave({ interviewAt: iso, interviewLocation: location.trim() || null });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-elev-3 w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-brand-navy mb-1">
          Schedule interview
        </h3>
        <p className="text-xs text-muted mb-4">
          {app.studentName ?? 'Student'}
          {app.studentCode && ` · ${app.studentCode}`}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Date &amp; time
            </span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              required
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            />
          </label>
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Conf Rm A, Zoom link, or full address"
            maxLength={240}
          />
          {err && (
            <div role="alert" className="rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger">
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
            <Button type="button" onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Save schedule</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompaniesTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['placement', 'companies'],
    queryFn: () => placementApi.listCompanies(),
  });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      placementApi.createCompany({
        name,
        slug,
        website: website || null,
        industry: industry || null,
      }),
    onSuccess: () => {
      setName('');
      setSlug('');
      setWebsite('');
      setIndustry('');
      qc.invalidateQueries({ queryKey: ['placement', 'companies'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create.'),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Add company" subtitle="Company directory powers the posting dropdown." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
          className="grid sm:grid-cols-2 gap-3"
        >
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. air-india-express"
            required
          />
          <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <Input label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          {error && (
            <div role="alert" className="sm:col-span-2 rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger">
              {error}
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" loading={create.isPending}>
              Add company
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Companies" subtitle={`${q.data?.length ?? 0} on file`} />
        {q.isLoading && <Skeleton lines={3} />}
        {q.data?.length === 0 && <EmptyState title="No companies yet" message="" />}
        {q.data && q.data.length > 0 && (
          <ul className="divide-y divide-black/5">
            {q.data.map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-navy">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.industry ?? '—'}
                    {c.website && (
                      <>
                        {' · '}
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-orange hover:underline"
                        >
                          {c.website}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted">{c.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AnalyticsTab() {
  const q = useQuery({
    queryKey: ['placement', 'analytics'],
    queryFn: () => placementApi.analytics(),
  });
  if (q.isLoading) return <Skeleton lines={5} />;
  if (q.isError)
    return (
      <ErrorAlert
        message={(q.error as Error).message}
        onRetry={() => q.refetch()}
      />
    );
  const a = q.data!;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Companies" value={String(a.totalCompanies)} />
        <Tile label="Postings" value={String(a.totalPostings)} sub={`${a.publishedPostings} published`} />
        <Tile label="Applications" value={String(a.totalApplications)} />
        <Tile label="Selected" value={String(a.applicationsByStatus.selected)} tone="success" />
      </div>
      <Card>
        <CardHeader title="By status" subtitle="" />
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(a.applicationsByStatus).map(([k, v]) => (
            <li key={k} className="rounded-xl bg-surface-muted p-3">
              <p className="text-xs uppercase tracking-wider text-muted font-bold capitalize">
                {k.replace('_', ' ')}
              </p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-brand-navy">{v}</p>
            </li>
          ))}
        </ul>
      </Card>
      {a.topCompanies.length > 0 && (
        <Card>
          <CardHeader title="Top companies by applications" subtitle="" />
          <ul className="divide-y divide-black/5">
            {a.topCompanies.map((t) => (
              <li key={t.companyId} className="py-2 flex items-center justify-between">
                <span className="font-medium text-brand-navy">{t.name}</span>
                <span className="font-mono tabular-nums text-sm">{t.applicationCount}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {a.byProgram.length > 0 && (
        <Card>
          <CardHeader title="By programme" subtitle="" />
          <ul className="divide-y divide-black/5">
            {a.byProgram.map((p) => (
              <li key={p.programId} className="py-2 flex items-center justify-between">
                <span className="font-medium text-brand-navy">{p.programName}</span>
                <span className="text-sm">
                  <span className="font-mono tabular-nums">{p.applicationsSubmitted}</span>{' '}
                  applications ·{' '}
                  <span className="font-mono tabular-nums text-success">{p.selectedCount}</span>{' '}
                  selected
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'success';
}) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-muted font-bold">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
          tone === 'success' ? 'text-success' : 'text-brand-navy'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}
