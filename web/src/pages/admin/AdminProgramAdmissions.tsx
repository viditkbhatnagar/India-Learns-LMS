import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgramDto } from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { programsApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

// Admin → per-program admissions config. Lets the admin toggle the funnel
// on/off, set the application fee, choose cohort_pick vs program_only, and
// configure the required documents + statement + references requirements.

type DocReq = ProgramDto['requiredDocs'][number];

const DOC_TYPE_LABELS: Record<DocReq['documentType'], string> = {
  govid: 'Government ID',
  transcript: 'Prior transcript',
  resume: 'Resume / CV',
  portfolio: 'Portfolio',
  test_score: 'Test score report',
  other: 'Other document',
};

export function AdminProgramAdmissionsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const programQ = useQuery({
    queryKey: ['programs', id],
    queryFn: () => programsApi.get(id),
    enabled: Boolean(id),
  });

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'cohort_pick' | 'program_only'>('cohort_pick');
  const [feeRupees, setFeeRupees] = useState('0');
  const [requiredDocs, setRequiredDocs] = useState<DocReq[]>([]);
  const [requiresStatement, setRequiresStatement] = useState(false);
  const [statementWordLimit, setStatementWordLimit] = useState('1000');
  const [requiresReferences, setRequiresReferences] = useState(false);
  const [referencesMinCount, setReferencesMinCount] = useState('0');
  const [referencesMaxCount, setReferencesMaxCount] = useState('2');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!programQ.data) return;
    setEnabled(programQ.data.admissionsEnabled);
    setMode(programQ.data.admissionMode);
    setFeeRupees(String(Math.round(programQ.data.applicationFeePaise / 100)));
    setRequiredDocs(programQ.data.requiredDocs);
    setRequiresStatement(programQ.data.requiresStatement);
    setStatementWordLimit(String(programQ.data.statementWordLimit));
    setRequiresReferences(programQ.data.requiresReferences);
    setReferencesMinCount(String(programQ.data.referencesMinCount));
    setReferencesMaxCount(String(programQ.data.referencesMaxCount));
  }, [programQ.data]);

  const save = useMutation({
    mutationFn: () =>
      programsApi.update(id, {
        admissionsEnabled: enabled,
        admissionMode: mode,
        applicationFeePaise: Math.max(0, Math.round(Number(feeRupees) * 100)),
        requiredDocs,
        requiresStatement,
        statementWordLimit: Math.max(50, Math.min(5000, Number(statementWordLimit) || 1000)),
        requiresReferences,
        referencesMinCount: Math.max(0, Math.min(5, Number(referencesMinCount) || 0)),
        referencesMaxCount: Math.max(0, Math.min(5, Number(referencesMaxCount) || 2)),
      }),
    onSuccess: (program) => {
      qc.setQueryData(['programs', id], program);
      qc.invalidateQueries({ queryKey: ['programs'] });
      setSavedAt(new Date().toLocaleTimeString());
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Save failed.');
    },
  });

  if (programQ.isLoading) return <Skeleton lines={6} />;
  if (programQ.isError || !programQ.data) {
    return <ErrorAlert message={(programQ.error as Error)?.message ?? 'Program not found.'} />;
  }
  const program = programQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admissions config"
        title={program.name}
        subtitle={`${program.slug} · per-program admissions setup`}
        back={{ to: '/admin/programs', label: 'All programs' }}
      />

      <Card accent="navy">
        <CardHeader title="Funnel toggle" subtitle="When ON, this program appears on the public /apply page and accepts applications." />
        <div className="flex items-center justify-between gap-4 p-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-semibold text-brand-navy">
              Admissions enabled
            </span>
            {enabled ? (
              <Badge tone="success" dot>On</Badge>
            ) : (
              <Badge tone="neutral" dot>Off</Badge>
            )}
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Cohort selection" subtitle="Decide whether applicants pick a cohort up-front or the Admissions Officer assigns one after admit." />
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="admissionMode"
              checked={mode === 'cohort_pick'}
              onChange={() => setMode('cohort_pick')}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-brand-navy">Cohort pick</span>
              <span className="block text-sm text-muted">Applicants choose an open cohort during Step 4 of the form. Best when start dates matter.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="admissionMode"
              checked={mode === 'program_only'}
              onChange={() => setMode('program_only')}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-brand-navy">Program only</span>
              <span className="block text-sm text-muted">Applicants pick the program; the Admissions Officer assigns a cohort at admit time.</span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Application fee" subtitle="Charged once at submit. Manual recording — no online payment processor in Phase 1." />
        <div className="max-w-xs">
          <Input
            type="number"
            min="0"
            label="Fee in INR (₹)"
            value={feeRupees}
            onChange={(e) => setFeeRupees(e.target.value)}
            hint="0 = free. Stored internally as paise."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Required documents" subtitle="Per-document-type slots in Step 6 of the form." />
        <div className="space-y-3">
          {requiredDocs.map((d, i) => (
            <div key={`${d.documentType}-${i}`} className="grid sm:grid-cols-[1fr,1fr,auto,auto] gap-3 items-end">
              <SelectField
                label="Type"
                value={d.documentType}
                onChange={(v) =>
                  setRequiredDocs((prev) =>
                    prev.map((row, idx) =>
                      idx === i ? { ...row, documentType: v as DocReq['documentType'] } : row,
                    ),
                  )
                }
                options={Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Label shown to applicant"
                value={d.label}
                onChange={(e) =>
                  setRequiredDocs((prev) =>
                    prev.map((row, idx) =>
                      idx === i ? { ...row, label: e.target.value } : row,
                    ),
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={d.required}
                  onChange={(e) =>
                    setRequiredDocs((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, required: e.target.checked } : row,
                      ),
                    )
                  }
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRequiredDocs((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setRequiredDocs((prev) => [
                ...prev,
                { documentType: 'other', label: 'New document', required: false },
              ])
            }
          >
            + Add document slot
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Personal statement" subtitle="Optional long-text section in Step 7." />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requiresStatement}
            onChange={(e) => setRequiresStatement(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="font-semibold text-brand-navy">Require statement</span>
        </label>
        <div className="max-w-xs mt-3">
          <Input
            type="number"
            min="50"
            max="5000"
            label="Word limit"
            value={statementWordLimit}
            onChange={(e) => setStatementWordLimit(e.target.value)}
            hint="Applicants see a live counter."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="References" subtitle="Step 8 — applicants invite referees who get a tokenized upload link." />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requiresReferences}
            onChange={(e) => setRequiresReferences(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="font-semibold text-brand-navy">Require references</span>
        </label>
        <div className="grid sm:grid-cols-2 gap-3 mt-3 max-w-md">
          <Input
            type="number"
            min="0"
            max="5"
            label="Minimum"
            value={referencesMinCount}
            onChange={(e) => setReferencesMinCount(e.target.value)}
          />
          <Input
            type="number"
            min="0"
            max="5"
            label="Maximum"
            value={referencesMaxCount}
            onChange={(e) => setReferencesMaxCount(e.target.value)}
          />
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 sticky bottom-4">
        <div className="text-xs text-muted">
          {savedAt ? <>Last saved at {savedAt}</> : 'Unsaved changes after first edit.'}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/programs">
            <Button variant="ghost">Back</Button>
          </Link>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save admissions config
          </Button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-brand-navy mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white text-ink focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
