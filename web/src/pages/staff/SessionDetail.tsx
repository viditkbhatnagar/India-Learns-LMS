import { useEffect, useMemo, useState, type JSX } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { FileDropZone } from '../../components/ui/FileDropZone.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import {
  assignmentsApi,
  filesApi,
  materialsApi,
  sessionsApi,
  type AddableMaterialType,
  type AttendanceRecordDto,
  type AttendanceStatus,
  type SessionDetailDto,
} from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';
import { formatIstDateTime } from '../../lib/format.js';
import { useCourseOversight } from '../../contexts/CourseOversightContext.js';

type ChosenStatus = AttendanceStatus;

const STATUS_OPTIONS: ChosenStatus[] = ['present', 'absent', 'late', 'excused'];

/**
 * Phase B-2 session detail. Two-column layout per developer-handoff §7:
 *   Left  (2/3) → description, materials, assignments
 *   Right (1/3) → attendance summary + private notes
 *
 * Marked-complete + uncomplete-within-7d controls live above the columns.
 * Auto-generated sessions render the same controls but the description /
 * notes area shows a banner indicating the session was created by the
 * curriculum import.
 */
export function SessionDetailPage(): JSX.Element | null {
  const { id: courseId = '', sessionId = '' } = useParams<{ id: string; sessionId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isOversight } = useCourseOversight();
  // Short, scannable tooltip — matches the title attribute the operator
  // greps for in the headless verification step.
  const oversightTitle = 'Read-only in oversight mode';

  const detailQ = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.detail(sessionId),
    enabled: Boolean(sessionId),
  });

  const enrolmentsForRosterQ = useQuery({
    queryKey: ['gradebook', courseId, 'students-only'],
    queryFn: () => assignmentsApi.gradebook(courseId),
    enabled: Boolean(courseId),
  });

  const attendanceListQ = useQuery({
    queryKey: ['session', sessionId, 'attendance'],
    queryFn: () => sessionsApi.listAttendance(sessionId),
    enabled: Boolean(sessionId),
  });

  const completeMut = useMutation({
    mutationFn: () => sessionsApi.complete(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['course', courseId, 'sessions'] });
    },
  });
  const uncompleteMut = useMutation({
    mutationFn: () => sessionsApi.uncomplete(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['course', courseId, 'sessions'] });
    },
  });

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);

  // Hydrate notes draft from server doc on first render / refetch.
  const serverNotes = detailQ.data?.session.notes ?? '';
  useEffect(() => {
    if (notesDraft === null && detailQ.data) setNotesDraft(serverNotes);
  }, [detailQ.data, notesDraft, serverNotes]);

  const notesMut = useMutation({
    mutationFn: (notes: string) => sessionsApi.update(sessionId, { notes }),
    onSuccess: () => {
      setNotesSavedAt(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });

  // Attendance roster — default every enrolled student to 'present' until
  // toggled. Existing records preempt the default.
  const enrolledStudents = useMemo(
    () => enrolmentsForRosterQ.data?.students ?? [],
    [enrolmentsForRosterQ.data?.students],
  );
  const recordsByStudent = useMemo(() => {
    const m = new Map<string, AttendanceRecordDto>();
    for (const r of attendanceListQ.data ?? []) m.set(r.studentId, r);
    return m;
  }, [attendanceListQ.data]);

  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, ChosenStatus>>({});
  useEffect(() => {
    // Seed defaults: existing record's status, or 'present' if none.
    if (attendanceListQ.data && enrolledStudents.length > 0 && Object.keys(attendanceDraft).length === 0) {
      const seed: Record<string, ChosenStatus> = {};
      for (const s of enrolledStudents) {
        seed[s.id] = (recordsByStudent.get(s.id)?.status as ChosenStatus | undefined) ?? 'present';
      }
      setAttendanceDraft(seed);
    }
  }, [attendanceListQ.data, enrolledStudents, recordsByStudent, attendanceDraft]);

  const recordAttendanceMut = useMutation({
    mutationFn: () =>
      sessionsApi.recordAttendance(
        sessionId,
        Object.entries(attendanceDraft).map(([studentId, status]) => ({ studentId, status })),
      ),
    onSuccess: (result) => {
      // F1 (PR #15) — flip "0 of 3 recorded" → "3 of 3" the moment the
      // save resolves. Without this, the counter stays stale until the
      // background invalidate completes a refetch round-trip; faculty
      // assumed the save failed and clicked again.
      qc.setQueryData<SessionDetailDto>(['session', sessionId], (prev) => {
        if (!prev) return prev;
        const counts = { present: 0, absent: 0, late: 0, excused: 0 };
        for (const r of result.records) {
          if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
        }
        return {
          ...prev,
          attendanceSummary: {
            ...prev.attendanceSummary,
            recorded: result.records.length,
            ...counts,
          },
        };
      });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId, 'attendance'] });
    },
  });

  if (detailQ.isLoading) return <Skeleton variant="card" />;
  if (detailQ.isError) {
    return <ErrorAlert message={(detailQ.error as Error).message} onRetry={() => detailQ.refetch()} />;
  }
  if (!detailQ.data) return null;

  const { session, materials, assignments, attendanceSummary } = detailQ.data;
  const isAutoGen = session.isAutoGenerated;
  const isCompleted = session.status === 'completed';
  const undoUntil = session.completionUndoableUntil ? new Date(session.completionUndoableUntil) : null;
  const undoOpen = isCompleted && undoUntil && undoUntil.getTime() > Date.now();

  const completionMutError = completeMut.error instanceof ApiHttpError ? completeMut.error.message
    : completeMut.error ? (completeMut.error as Error).message : null;
  const uncompleteMutError = uncompleteMut.error instanceof ApiHttpError ? uncompleteMut.error.message
    : uncompleteMut.error ? (uncompleteMut.error as Error).message : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            type="button"
            onClick={() => navigate(`/courses/${courseId}/content`)}
            className="text-sm text-brand-orange hover:underline"
          >
            ← Back to content
          </button>
          <h2 className="text-display-sm text-brand-navy tracking-tight mt-1">{session.title}</h2>
          <p className="text-xs text-muted mt-1 flex items-center gap-2 flex-wrap">
            <Badge
              tone={isCompleted ? 'success' : session.status === 'in_progress' ? 'warning' : 'neutral'}
              size="sm"
            >
              {session.status === 'in_progress' ? 'in progress' : session.status}
            </Badge>
            {isAutoGen && <Badge tone="accent" size="sm">Auto-generated</Badge>}
            {session.plannedMinutes && <span>{session.plannedMinutes} min</span>}
            {session.location && <span>· {session.location}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isCompleted ? (
            <Button
              loading={completeMut.isPending}
              onClick={() => completeMut.mutate()}
              disabled={attendanceSummary.recorded === 0 || isOversight}
              title={
                isOversight
                  ? oversightTitle
                  : attendanceSummary.recorded === 0
                    ? 'Take attendance for at least one student before marking complete.'
                    : 'Mark this session complete.'
              }
            >
              Mark complete
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                loading={uncompleteMut.isPending}
                disabled={!undoOpen || isOversight}
                onClick={() => {
                  if (window.confirm('Uncomplete this session?')) {
                    uncompleteMut.mutate();
                  }
                }}
                title={
                  isOversight
                    ? oversightTitle
                    : undoOpen
                      ? `Undo available until ${undoUntil!.toLocaleString()}`
                      : 'The 7-day undo window has expired. This session is locked.'
                }
              >
                {undoOpen ? 'Undo complete' : 'Locked'}
              </Button>
              {/* F2 (PR #15) — visible deadline so faculty know how long the
                  undo window stays open without hovering for the tooltip.
                  Shown only while the window is still open; once locked,
                  the button label changes to "Locked" and that's signal
                  enough. */}
              {undoOpen && undoUntil && (
                <span className="text-xs text-muted">
                  Undo until {undoUntil.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {' '}{undoUntil.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {(completionMutError || uncompleteMutError) && (
        <ErrorAlert message={completionMutError ?? uncompleteMutError ?? 'Action failed.'} />
      )}

      {isAutoGen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <strong>Auto-generated session.</strong> This was created by the curriculum
          import to host {session.type === 'exam' ? 'the summative exam' : 'assignment-pack variants'}.
          Title is read-only; reordering is locked. You can still take attendance and
          mark it complete.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Description" />
            <SessionDescriptionEditor
              sessionId={sessionId}
              initialValue={session.description ?? ''}
              isOversight={isOversight}
              oversightTitle={oversightTitle}
            />
          </Card>

          <Card>
            <CardHeader
              title="Materials"
              subtitle={`${materials.length} item${materials.length === 1 ? '' : 's'}`}
            />
            {materials.length === 0 ? (
              <p className="text-sm text-muted italic">No materials attached to this session yet.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {materials.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/courses/${courseId}/sessions/${sessionId}/materials/${m.id}`}
                      className="py-2 flex items-center gap-3 text-sm hover:bg-surface-muted/60 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className="text-xs uppercase tracking-wider font-bold text-muted w-16">
                        {m.type}
                      </span>
                      <span className="font-medium text-brand-navy flex-1 truncate hover:text-brand-orange">
                        {m.title}
                      </span>
                      {m.slideCount && <span className="text-xs text-muted">{m.slideCount} slides</span>}
                      {m.type === 'slides' && (
                        <span className="text-xs text-brand-orange font-medium">Open viewer →</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <AddMaterialForm
              sessionId={sessionId}
              isOversight={isOversight}
              oversightTitle={oversightTitle}
            />
          </Card>

          <Card>
            <CardHeader
              title="Assignments"
              subtitle={`${assignments.length} attached`}
            />
            {assignments.length === 0 ? (
              <p className="text-sm text-muted italic">No assignments anchored to this session.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {assignments.map((a) => (
                  <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
                    <Link
                      to={`/courses/${courseId}/assignments/${a.id}/grading`}
                      className="font-medium text-brand-navy hover:text-brand-orange flex-1 truncate"
                    >
                      {a.title}
                    </Link>
                    {a.deliveryVariant && (
                      <Badge tone="info" size="sm">{a.deliveryVariant.replace('_', ' ')}</Badge>
                    )}
                    <span className="text-xs text-muted">/{a.maxScore}</span>
                    <span className="text-xs text-muted">{formatIstDateTime(a.dueAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <AddAssignmentForm
              sessionId={sessionId}
              courseId={courseId}
              isOversight={isOversight}
              oversightTitle={oversightTitle}
            />
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Attendance" subtitle={`${attendanceSummary.recorded} of ${attendanceSummary.enrolled} recorded`} />
            {enrolmentsForRosterQ.isLoading || attendanceListQ.isLoading ? (
              <Skeleton lines={3} />
            ) : enrolledStudents.length === 0 ? (
              <p className="text-sm text-muted italic">No students enrolled in this course.</p>
            ) : (
              <>
                <ul className="max-h-80 overflow-y-auto -mx-2 divide-y divide-black/5">
                  {enrolledStudents.map((stu) => {
                    const value = attendanceDraft[stu.id] ?? 'present';
                    return (
                      <li key={stu.id} className="px-2 py-2 text-sm flex items-center gap-2">
                        <span className="flex-1 truncate text-brand-navy">{stu.name}</span>
                        <select
                          value={value}
                          onChange={(e) =>
                            setAttendanceDraft((prev) => ({
                              ...prev,
                              [stu.id]: e.target.value as ChosenStatus,
                            }))
                          }
                          disabled={isOversight}
                          className="h-8 px-2 text-xs rounded-md border border-black/10 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    loading={recordAttendanceMut.isPending}
                    onClick={() => recordAttendanceMut.mutate()}
                    disabled={isOversight}
                    title={isOversight ? oversightTitle : undefined}
                  >
                    Save attendance
                  </Button>
                  {recordAttendanceMut.isSuccess && (
                    <span className="text-xs text-success">Saved.</span>
                  )}
                  {recordAttendanceMut.isError && (
                    <span className="text-xs text-danger">
                      {(recordAttendanceMut.error as Error).message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-2">
                  Defaults to "present"; toggle individual rows.
                </p>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Private notes" subtitle="Faculty-only — never shown to students." />
            <TextArea
              rows={6}
              value={notesDraft ?? ''}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Pacing notes, common misconceptions, follow-up reminders…"
              disabled={isOversight}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={notesMut.isPending}
                onClick={() => {
                  if (notesDraft !== null) notesMut.mutate(notesDraft);
                }}
                disabled={notesDraft === serverNotes || isOversight}
                title={isOversight ? oversightTitle : undefined}
              >
                Save notes
              </Button>
              {notesSavedAt && (
                <span className="text-xs text-muted">
                  Saved {new Date(notesSavedAt).toLocaleTimeString()}.
                </span>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}


/**
 * PR #16 — editable session description. Faculty can adapt the
 * curriculum-import description to their cohort. Admins are unrestricted;
 * faculty must be on the course roster (server enforces via
 * `assertFacultyCanWriteCourse`); oversight viewers see a disabled state.
 */
function SessionDescriptionEditor({
  sessionId,
  initialValue,
  isOversight,
  oversightTitle,
}: {
  sessionId: string;
  initialValue: string;
  isOversight: boolean;
  oversightTitle: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(initialValue);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Re-seed when the upstream prop changes (e.g. after invalidation).
  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const mut = useMutation({
    mutationFn: (description: string) => sessionsApi.update(sessionId, { description }),
    onSuccess: () => {
      setSavedAt(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });

  const dirty = draft !== initialValue;
  const errorMsg = mut.error instanceof ApiHttpError ? mut.error.message
    : mut.error ? (mut.error as Error).message : null;

  return (
    <div className="space-y-2">
      <TextArea
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What is this session about? Faculty + students will see this."
        disabled={isOversight}
        maxLength={8000}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={mut.isPending}
          onClick={() => mut.mutate(draft)}
          disabled={!dirty || isOversight}
          title={isOversight ? oversightTitle : undefined}
        >
          Save description
        </Button>
        {savedAt && !dirty && (
          <span className="text-xs text-muted">Saved {new Date(savedAt).toLocaleTimeString()}.</span>
        )}
        {errorMsg && <span className="text-xs text-danger">{errorMsg}</span>}
      </div>
    </div>
  );
}


/**
 * PR #16 Phase 2 — inline "add material" form. URL-based for now;
 * slide decks have their own upload flow. Type defaults to "link"
 * because that's what 90% of paste-from-Drive faculty traffic uses.
 */
function AddMaterialForm({
  sessionId,
  isOversight,
  oversightTitle,
}: {
  sessionId: string;
  isOversight: boolean;
  oversightTitle: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AddableMaterialType>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      materialsApi.createOnSession(sessionId, {
        type,
        title: title.trim(),
        url: url.trim() || null,
        body: body.trim() || null,
      }),
    onSuccess: () => {
      setErr(null);
      setTitle('');
      setUrl('');
      setBody('');
      setUploadedName(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Add failed.'),
  });

  // Direct file upload (PowerPoint / PDF / etc.) → S3 via the shared
  // /v1/files/upload endpoint. Fills the URL field with the returned
  // proxy link so students can download the file. Faculty no longer
  // need to host on Drive and paste a link.
  const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;
  async function handleMaterialFile(file: File): Promise<void> {
    setErr(null);
    if (file.size > MAX_MATERIAL_BYTES) {
      setErr('File must be 25 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const { url: uploadedUrl } = await filesApi.upload(file, 'course-pdfs');
      setUrl(uploadedUrl);
      setUploadedName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setErr(e instanceof ApiHttpError ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          disabled={isOversight}
          title={isOversight ? oversightTitle : undefined}
        >
          + Add material
        </Button>
      </div>
    );
  }
  // The reading variant takes a markdown body; everything else takes a URL.
  const isReading = type === 'reading';
  const canSubmit = title.trim().length > 0 && (isReading ? body.trim().length > 0 : url.trim().length > 0);
  return (
    <form
      className="mt-3 space-y-3 border-t border-black/5 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mut.mutate();
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={400}
          required
        />
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-muted font-bold mb-1.5">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AddableMaterialType)}
            className="h-11 px-3.5 rounded-xl border border-black/10 bg-white"
          >
            <option value="link">Link</option>
            <option value="reading">Reading (markdown)</option>
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="file">File</option>
            <option value="practice">Practice</option>
            <option value="reflection">Reflection</option>
            <option value="case">Case</option>
          </select>
        </label>
      </div>
      {isReading ? (
        <TextArea
          label="Body (markdown)"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={16_000}
        />
      ) : (
        <div className="space-y-2">
          <FileDropZone
            onFile={(f) => {
              handleMaterialFile(f).catch(() => {
                /* surfaced via setErr */
              });
            }}
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.mp4,.png,.jpg,.jpeg"
            maxBytes={25 * 1024 * 1024}
            busy={uploading}
            busyLabel="Uploading…"
            label="Drag a PowerPoint / PDF here"
            hint="Any file up to 25 MB — students get a download link."
          />
          {uploadedName && !uploading && (
            <p className="text-xs text-success truncate">
              Uploaded {uploadedName} ✓
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">or paste a link to a file hosted elsewhere:</span>
          </div>
          <Input
            label="URL"
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUploadedName(null);
            }}
            maxLength={2048}
          />
        </div>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={mut.isPending} disabled={!canSubmit}>
          Add material
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * PR #16 Phase 2 — inline "add assignment" form. Posts to
 * /v1/sessions/:id/assignments and the new row appears in the
 * Assignments list above (via cache invalidation).
 */
function AddAssignmentForm({
  sessionId,
  courseId,
  isOversight,
  oversightTitle,
}: {
  sessionId: string;
  courseId: string;
  isOversight: boolean;
  oversightTitle: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [maxScore, setMaxScore] = useState(100);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      assignmentsApi.createOnSession(sessionId, {
        title: title.trim(),
        instructions: instructions.trim(),
        dueAt: new Date(dueAt).toISOString(),
        maxScore,
      }),
    onSuccess: () => {
      setErr(null);
      setTitle('');
      setInstructions('');
      setMaxScore(100);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Add failed.'),
  });

  if (!open) {
    return (
      <div className="mt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          disabled={isOversight}
          title={isOversight ? oversightTitle : undefined}
        >
          + Add assignment
        </Button>
      </div>
    );
  }
  const canSubmit = title.trim().length > 0 && instructions.trim().length > 0 && maxScore > 0;
  return (
    <form
      className="mt-3 space-y-3 border-t border-black/5 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mut.mutate();
      }}
    >
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={240}
        required
      />
      <TextArea
        label="Instructions"
        rows={4}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        maxLength={8000}
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-muted font-bold mb-1.5">Due at</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white"
            required
          />
        </label>
        <Input
          label="Max score"
          type="number"
          min={1}
          max={1000}
          value={String(maxScore)}
          onChange={(e) => setMaxScore(Number(e.target.value) || 0)}
          required
        />
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={mut.isPending} disabled={!canSubmit}>
          Add assignment
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
