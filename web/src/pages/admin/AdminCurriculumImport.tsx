import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import {
  curriculumImportApi,
  programsApi,
  type CurriculumImportPreview,
  type CurriculumImportResult,
} from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

function formatBoolean(b: boolean): string {
  return b ? 'Yes' : 'No';
}

const OBJECT_ID_RE = /[a-f0-9]{24}/i;

/**
 * Operators copy-paste from the generator's URL bar (e.g.
 * `https://curriculum-frontend-xfyx.onrender.com/workflow/<24hex>`)
 * about half the time. Pull the first 24-hex match out of whatever they
 * typed; only reject the input if no 24-hex substring exists.
 */
function extractWorkflowId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(OBJECT_ID_RE);
  return m ? m[0] : trimmed;
}

function formatDateMaybe(iso: string | null): string {
  if (!iso) return 'unknown';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * "No-op" means the persister hit the idempotent-already-imported branch
 * and returned existing-course with all-zero counts. The UI should NOT
 * say "Import successful" in that case — it lies.
 */
function isNoOp(result: CurriculumImportResult): boolean {
  const c = result.created;
  return !c.course && c.modules === 0 && c.sessions === 0 && c.materials === 0 && c.assignments === 0;
}

/** How many repeated lessons the importer auto-removed (from its warnings). */
function countDuplicatesRemoved(warnings: string[]): number {
  return warnings.filter((w) => /identical title and objectives/i.test(w)).length;
}

const SELECT_CLS =
  'w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all';

export function AdminCurriculumImport() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [workflowId, setWorkflowId] = useState('');
  const [programId, setProgramId] = useState('');
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<CurriculumImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<CurriculumImportResult | null>(null);

  const healthQ = useQuery({
    queryKey: ['curriculum-import', 'health'],
    queryFn: curriculumImportApi.health,
    staleTime: 60_000,
  });

  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });

  const workflowsQ = useQuery({
    queryKey: ['curriculum-import', 'workflows'],
    queryFn: curriculumImportApi.listWorkflows,
    staleTime: 60_000,
  });

  const previewMut = useMutation({
    mutationFn: (id?: string) => curriculumImportApi.preview(extractWorkflowId(id ?? workflowId)),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewError(null);
    },
    onError: (err) => {
      setPreview(null);
      setPreviewError(err instanceof ApiHttpError ? err.message : 'Preview failed.');
    },
  });

  const importMut = useMutation({
    mutationFn: () =>
      curriculumImportApi.run({
        workflowId: extractWorkflowId(workflowId),
        programId,
        replace,
      }),
    onSuccess: (data) => {
      setResult(data);
      setImportError(null);
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err) => {
      setResult(null);
      setImportError(err instanceof ApiHttpError ? err.message : 'Import failed.');
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Super admin"
        title="Curriculum import"
        subtitle="Import a course from the curriculum generator. Super-admin only."
      />

      <Card>
        <CardHeader title="Generator status" />
        {healthQ.isLoading ? (
          <Skeleton lines={1} />
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Badge tone={healthQ.data?.ok ? 'success' : 'danger'} dot>
              {healthQ.data?.ok ? 'Reachable' : 'Unreachable'}
            </Badge>
            <span className="text-muted font-mono">{healthQ.data?.baseUrl ?? '—'}</span>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ['curriculum-import', 'health'] })}
              className="ml-auto text-xs text-brand-orange hover:underline"
            >
              Refresh
            </button>
          </div>
        )}
        <p className="text-xs text-muted mt-2">
          Read endpoints (workflow fetch) are unauthenticated; first call after idle may take ~30s while the generator wakes.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Choose a curriculum"
          subtitle="Pick a curriculum from the generator by name — no ID needed."
        />
        {workflowsQ.isLoading ? (
          <Skeleton lines={1} />
        ) : workflowsQ.isError ? (
          <p className="text-sm text-muted">
            Couldn't load the list (the generator may be waking up — try Refresh above, or paste an ID below).
          </p>
        ) : (
          <select
            value={
              workflowId && (workflowsQ.data ?? []).some((w) => w.id === workflowId) ? workflowId : ''
            }
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              setWorkflowId(id);
              setResult(null);
              setPreviewError(null);
              previewMut.mutate(id);
            }}
            className={SELECT_CLS}
          >
            <option value="">— Select a curriculum —</option>
            {(workflowsQ.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.status ? ` — ${w.status.replace(/_/g, ' ')}` : ''}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted mt-2">
          Selecting a curriculum previews it automatically. Repeated lessons are removed for you on import.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Step 1 — Preview"
          subtitle="Or paste a workflow ID / URL and the LMS will fetch + validate the workflow."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (workflowId.trim()) {
              setResult(null);
              previewMut.mutate(undefined);
            }
          }}
          className="space-y-3"
        >
          <Input
            label="Workflow ID or URL"
            placeholder="e.g. 69bbf3cd5c4093e441e75eba or full /workflow/<id> URL"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            hint="Paste either the 24-hex id or the generator's URL — we'll extract the id."
            required
          />
          <Button type="submit" loading={previewMut.isPending} disabled={!workflowId.trim()}>
            Fetch preview
          </Button>
          {previewError && <ErrorAlert message={previewError} />}
        </form>
      </Card>

      {preview && (
        <Card accent="navy">
          <CardHeader
            title="Preview"
            subtitle={`${preview.course.name} · ${preview.workflowStatus}`}
          />
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">PLOs</dt>
              <dd className="text-2xl font-bold text-brand-navy">{preview.counts.plos}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Modules</dt>
              <dd className="text-2xl font-bold text-brand-navy">{preview.counts.modules}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Sessions</dt>
              <dd className="text-2xl font-bold text-brand-navy">{preview.counts.sessions}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Slide decks</dt>
              <dd className="text-2xl font-bold text-brand-navy">{preview.counts.materials}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Assignments</dt>
              <dd className="text-2xl font-bold text-brand-navy">{preview.counts.assignments}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Already imported</dt>
              <dd className="text-base font-semibold text-brand-navy mt-1">
                {formatBoolean(preview.alreadyImported)}
              </dd>
            </div>
          </dl>
          {preview.course.summary && (
            <div className="mt-4 p-3 rounded-lg bg-surface-muted text-sm leading-relaxed">
              {preview.course.summary}
              {preview.course.summary.length >= 600 && '…'}
            </div>
          )}
          {countDuplicatesRemoved(preview.warnings) > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-success/30 bg-success/5 text-sm text-brand-navy">
              ✓ {countDuplicatesRemoved(preview.warnings)} repeated lesson
              {countDuplicatesRemoved(preview.warnings) === 1 ? '' : 's'} will be removed automatically on import (the count above is already after removing them).
            </div>
          )}
          {preview.warnings.filter((w) => !/identical title and objectives/i.test(w)).length > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
              <p className="font-semibold text-amber-900 mb-1.5">Notes</p>
              <ul className="list-disc list-inside space-y-1 text-amber-900">
                {preview.warnings
                  .filter((w) => !/identical title and objectives/i.test(w))
                  .map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
              </ul>
            </div>
          )}
          {preview.alreadyImported && preview.existingCourseId && (
            <div className="mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm space-y-2">
              <p>
                <strong>Already imported.</strong>{' '}
                {preview.existingIsPartial
                  ? 'The previous import did not finish — there\'s partial state on the course. Hitting Import below will auto-recover (no replace toggle needed).'
                  : `Last synced ${formatDateMaybe(preview.existingLastSyncedAt)}. Tick "Replace existing" below to overwrite the imported children without touching anything you've added by hand.`}
              </p>
              <div className="flex gap-3">
                <Link
                  to={`/courses/${preview.existingCourseId}/overview`}
                  className="text-brand-orange hover:underline font-medium"
                >
                  Open existing course →
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}

      {preview && (
        <Card accent="orange">
          <CardHeader
            title="Step 2 — Import"
            subtitle="Pick the LMS Program this course belongs to, then commit."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (programId) importMut.mutate();
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
                Target program
              </span>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              >
                <option value="">— Select a program —</option>
                {(programsQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {preview.alreadyImported && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                  className="accent-brand-orange"
                />
                <span>Replace existing imported children (overwrites modules/sessions/materials/assignments from a prior import)</span>
              </label>
            )}
            <Button
              type="submit"
              size="lg"
              loading={importMut.isPending}
              disabled={!programId}
            >
              Import {preview.counts.modules} modules · {preview.counts.sessions} sessions ·{' '}
              {preview.counts.assignments} assignments
            </Button>
            {importError && <ErrorAlert message={importError} />}
          </form>
        </Card>
      )}

      {result && (
        <Card accent={isNoOp(result) ? 'orange' : 'navy'}>
          <CardHeader
            title={
              isNoOp(result)
                ? 'No changes — already imported'
                : result.created.course
                  ? 'Course created'
                  : 'Existing course updated'
            }
            subtitle={`Course id: ${result.courseId}`}
          />
          {isNoOp(result) ? (
            <div className="text-sm space-y-2">
              <p>
                This workflow was previously imported and the persister
                returned the existing course unchanged. Tick{' '}
                <strong>Replace existing</strong> on the import form above
                and re-run if you wanted to refresh the imported children.
              </p>
              <Link
                to={`/courses/${result.courseId}/overview`}
                className="inline-block text-brand-orange hover:underline font-medium"
              >
                Open existing course →
              </Link>
            </div>
          ) : (
            <ul className="text-sm space-y-1">
              <li>
                <span className="text-muted">Modules:</span> {result.created.modules}
              </li>
              <li><span className="text-muted">Sessions:</span> {result.created.sessions}</li>
              <li><span className="text-muted">Materials:</span> {result.created.materials}</li>
              <li><span className="text-muted">Assignments:</span> {result.created.assignments}</li>
            </ul>
          )}
          {countDuplicatesRemoved(result.warnings) > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-success/30 bg-success/5 text-sm text-brand-navy">
              ✓ Removed {countDuplicatesRemoved(result.warnings)} repeated lesson
              {countDuplicatesRemoved(result.warnings) === 1 ? '' : 's'} automatically.
            </div>
          )}
          {result.warnings.filter((w) => !/identical title and objectives/i.test(w)).length > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
              <p className="font-semibold text-amber-900 mb-1.5">Notes</p>
              <ul className="list-disc list-inside space-y-1 text-amber-900">
                {result.warnings
                  .filter((w) => !/identical title and objectives/i.test(w))
                  .map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Link to={`/admin/courses/${result.courseId}`}>
              <Button>Open course</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setPreview(null);
                setWorkflowId('');
                setProgramId('');
                setReplace(false);
              }}
            >
              Import another
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/courses')}
            >
              Back to courses
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
