import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApplicationState } from 'india-learns-shared-types';
import { Badge } from '../../components/ui/Badge.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Input } from '../../components/ui/Input.js';
import { admissionsApi } from '../../lib/endpoints.js';

const STATE_TONE: Record<
  ApplicationState,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  draft: 'warning',
  submitted: 'info',
  under_review: 'info',
  decision_pending: 'info',
  admitted: 'success',
  denied: 'danger',
  waitlisted: 'warning',
  withdrawn: 'neutral',
};

const STATE_FILTERS: Array<ApplicationState | 'all'> = [
  'all',
  'draft',
  'submitted',
  'under_review',
  'decision_pending',
  'admitted',
  'denied',
  'waitlisted',
  'withdrawn',
];

// M1 — Admissions officer dashboard. List of all applications with a state
// filter and a free-text search across code + applicant name/email. M5 will
// turn the rows into clickable detail pages (review notes, decision toolbar)
// — for now the row is a read-only summary.

export function AdmissionsDashboardPage() {
  const [stateFilter, setStateFilter] = useState<ApplicationState | 'all'>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admissions', 'officer', 'list', stateFilter, appliedSearch],
    queryFn: () =>
      admissionsApi.listForOfficer({
        state: stateFilter === 'all' ? undefined : stateFilter,
        q: appliedSearch || undefined,
        limit: 50,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admissions"
        title="Applications"
        subtitle="Review prospective students and progress them through the funnel."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="APP-2026-… · name · email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(search.trim());
            }}
          />
        </div>
        <div className="sm:max-w-xs w-full">
          <label
            htmlFor="state-filter"
            className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight"
          >
            State
          </label>
          <select
            id="state-filter"
            value={stateFilter}
            onChange={(e) =>
              setStateFilter(e.target.value as ApplicationState | 'all')
            }
            className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white text-ink focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange"
          >
            {STATE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All states' : value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-black/5 shadow-elev-1 overflow-hidden">
        {isLoading && (
          <p className="p-6 text-muted">Loading applications…</p>
        )}
        {isError && (
          <p role="alert" className="p-6 text-danger">
            {error instanceof Error
              ? error.message
              : 'Could not load applications.'}
          </p>
        )}
        {data && data.items.length === 0 && (
          <p className="p-10 text-center text-muted">
            No applications yet. Once prospective students sign up at /apply,
            their records appear here.
          </p>
        )}
        {data && data.items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-brand-navy">Code</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">Applicant</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">State</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">Started</th>
                <th className="px-4 py-3 font-semibold text-brand-navy">Last update</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-black/5 hover:bg-surface-muted/40"
                >
                  <td className="px-4 py-3 font-mono text-brand-navy">
                    <Link
                      to={`/admissions/applications/${row.id}`}
                      className="hover:text-brand-orange"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admissions/applications/${row.id}`}
                      className="text-ink hover:text-brand-orange"
                    >
                      <div>{row.applicantName || '—'}</div>
                      <div className="text-muted text-xs">{row.applicantEmail}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATE_TONE[row.state]}>{row.state.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <div className="border-t border-black/5 px-4 py-3 text-xs text-muted bg-surface-muted/40">
            {data.total} application{data.total === 1 ? '' : 's'} total · showing{' '}
            {data.items.length}
          </div>
        )}
      </section>
    </div>
  );
}
