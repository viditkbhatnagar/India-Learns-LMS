import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentDto, FeeInstallmentDto, InvoiceDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { adminEnrollmentsApi, installmentsApi, studentsApi, usersApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';
import { formatIstDate, formatIstDateTime, formatMoney } from '../../lib/format.js';

// M10s — Admin can now add + edit + waive individual installments after
// auto-gen. Aligns with Logan's Excel template (manual rows for
// "Seat Reservation" / "Upon Admission" alongside calendar-dated ones).

const STATUS_TONE: Record<
  FeeInstallmentDto['status'],
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'
> = {
  pending: 'info',
  partial: 'accent',
  paid: 'success',
  overdue: 'danger',
  waived: 'neutral',
};

export function FinanceStudentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const userQ = useQuery({ queryKey: ['user', id], queryFn: () => usersApi.get(id), enabled: !!id });
  const feesQ = useQuery({
    queryKey: ['finance', 'student-fees', id],
    queryFn: () => studentsApi.feesFor(id),
    enabled: !!id,
  });
  // M10x — Active enrolment carries the Excel "Total Fees Specified"
  // declaration. There can be multiple enrolments per student; we
  // surface the most-recent active one for the declared-total card.
  const enrolmentsQ = useQuery({
    queryKey: ['admin', 'enrollments', { studentId: id }],
    queryFn: () => adminEnrollmentsApi.list({ studentId: id }),
    enabled: !!id,
  });

  if (userQ.isLoading || feesQ.isLoading) return <Skeleton lines={6} />;
  if (userQ.isError) return <ErrorAlert message={(userQ.error as Error).message} />;
  if (feesQ.isError) return <ErrorAlert message={(feesQ.error as Error).message} />;
  const user = userQ.data!;
  const fees = feesQ.data!;
  const activeEnrolment =
    enrolmentsQ.data?.find((e) => e.status === 'active') ?? enrolmentsQ.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">{user.name}</h1>
          <p className="text-muted text-sm mt-1">
            {user.email} · {user.code && <span className="font-mono">{user.code}</span>}
          </p>
        </div>
        <Link to={`/finance/students/${id}/record-payment`}>
          <Button>Record payment</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total" value={formatMoney(fees.totalPaise)} />
        <Stat label="Paid" value={formatMoney(fees.paidPaise)} tone="success" />
        <Stat label="Outstanding" value={formatMoney(fees.balancePaise)} tone="danger" />
      </div>

      {/* M10x — Excel "Total Fees Specified" upfront declaration card. */}
      {activeEnrolment && (
        <DeclaredTotalCard
          enrolment={activeEnrolment}
          computedTotalPaise={fees.totalPaise}
        />
      )}

      <InstallmentsCard
        studentId={id}
        invoices={fees.invoices}
        installments={fees.installments}
      />

      <Card>
        <CardHeader title="Receipts" />
        {fees.receipts.length === 0 ? (
          <EmptyState title="No receipts yet" />
        ) : (
          <ul className="divide-y divide-black/5">
            {fees.receipts.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-brand-navy font-mono">{r.code}</p>
                  <p className="text-xs text-muted">issued {formatIstDateTime(r.issuedAt)}</p>
                </div>
                <a
                  href={r.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-orange hover:underline"
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p
        className={`font-semibold text-xl mt-1 font-mono tabular-nums ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-brand-navy'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function InstallmentsCard({
  studentId,
  invoices,
  installments,
}: {
  studentId: string;
  invoices: InvoiceDto[];
  installments: FeeInstallmentDto[];
}) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForInvoice, setShowAddForInvoice] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const waiveMut = useMutation({
    mutationFn: (instId: string) => installmentsApi.waive(instId),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Installment waived.' });
      qc.invalidateQueries({ queryKey: ['finance', 'student-fees', studentId] });
    },
    onError: (err) =>
      setMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Failed to waive.',
      }),
  });

  function invoiceLabel(invoiceId: string): string {
    const inv = invoices.find((i) => i.id === invoiceId);
    return inv ? `${inv.code} · ${inv.componentLabel}` : 'Unknown invoice';
  }

  return (
    <Card>
      <CardHeader
        title="Installments"
        subtitle="Admin can add, edit, or waive individual rows. Invoice totals update automatically."
      />
      {msg && (
        <div
          role={msg.kind === 'ok' ? 'status' : 'alert'}
          className={`mb-3 rounded-xl p-2.5 text-sm ${
            msg.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-success'
              : 'bg-red-50 border border-danger/30 text-danger'
          }`}
        >
          {msg.text}
        </div>
      )}

      {installments.length === 0 ? (
        <EmptyState
          title="No installments"
          message="Generate fees from the enrolment page first, then add manual rows here."
        />
      ) : (
        <ul className="divide-y divide-black/5">
          {installments.map((inst) =>
            editingId === inst.id ? (
              <li key={inst.id} className="py-3">
                <InstallmentEditForm
                  installment={inst}
                  onClose={() => setEditingId(null)}
                  onSaved={() => {
                    setMsg({ kind: 'ok', text: 'Installment updated.' });
                    setEditingId(null);
                    qc.invalidateQueries({ queryKey: ['finance', 'student-fees', studentId] });
                  }}
                  onError={(text) => setMsg({ kind: 'err', text })}
                />
              </li>
            ) : (
              <li key={inst.id} className="py-3 flex items-center justify-between text-sm gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-brand-navy truncate">{inst.label}</p>
                  <p className="text-xs text-muted">
                    {invoiceLabel(inst.invoiceId)} · due{' '}
                    {/* M10x — Milestone label takes precedence over calendar date */}
                    {inst.dueLabel ? (
                      <span className="font-semibold text-brand-orange">
                        {inst.dueLabel}
                      </span>
                    ) : (
                      formatIstDate(inst.dueDate)
                    )}{' '}
                    ·{' '}
                    <Badge tone={STATUS_TONE[inst.status]} size="sm">
                      {inst.status}
                    </Badge>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono tabular-nums text-base">
                    {formatMoney(inst.balancePaise)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(inst.id)}>
                    Edit
                  </Button>
                  {inst.status !== 'waived' && inst.status !== 'paid' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={waiveMut.isPending && waiveMut.variables === inst.id}
                      onClick={() => {
                        if (confirm('Waive this installment? It will be excluded from totals.')) {
                          setMsg(null);
                          waiveMut.mutate(inst.id);
                        }
                      }}
                    >
                      Waive
                    </Button>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="mt-4 pt-3 border-t border-black/5">
        <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">
          Add installment to an invoice
        </p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices exist yet for this student.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {invoices.map((inv) => (
              <Button
                key={inv.id}
                size="sm"
                variant={showAddForInvoice === inv.id ? 'primary' : 'secondary'}
                onClick={() =>
                  setShowAddForInvoice((cur) => (cur === inv.id ? null : inv.id))
                }
              >
                + {inv.code} · {inv.componentLabel}
              </Button>
            ))}
          </div>
        )}
        {showAddForInvoice && (
          <div className="mt-3">
            <InstallmentCreateForm
              invoiceId={showAddForInvoice}
              onClose={() => setShowAddForInvoice(null)}
              onSaved={() => {
                setMsg({ kind: 'ok', text: 'Installment added.' });
                setShowAddForInvoice(null);
                qc.invalidateQueries({ queryKey: ['finance', 'student-fees', studentId] });
              }}
              onError={(text) => setMsg({ kind: 'err', text })}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function InstallmentEditForm({
  installment,
  onClose,
  onSaved,
  onError,
}: {
  installment: FeeInstallmentDto;
  onClose: () => void;
  onSaved: () => void;
  onError: (text: string) => void;
}) {
  const [label, setLabel] = useState(installment.label);
  const [amountRupees, setAmountRupees] = useState(
    String(Math.round(installment.amountPaise / 100)),
  );
  const [dueDate, setDueDate] = useState(installment.dueDate.slice(0, 10));
  // M10x — Optional milestone label ("Seat Reservation" / "Upon Admission").
  const [dueLabel, setDueLabel] = useState(installment.dueLabel ?? '');
  const save = useMutation({
    mutationFn: () =>
      installmentsApi.update(installment.id, {
        label,
        amountPaise: Math.max(0, Math.round(Number(amountRupees) * 100)),
        dueDate,
        dueLabel: dueLabel.trim() || null,
      }),
    onSuccess: () => onSaved(),
    onError: (err) =>
      onError(err instanceof ApiHttpError ? err.message : 'Failed to update.'),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-5 gap-2 items-end bg-surface-muted/40 rounded-xl p-3">
      <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <Input
        label="Amount (₹)"
        type="number"
        min={0}
        value={amountRupees}
        onChange={(e) => setAmountRupees(e.target.value)}
        required
      />
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
      />
      <Input
        label="Milestone (optional)"
        value={dueLabel}
        onChange={(e) => setDueLabel(e.target.value)}
        placeholder="e.g. Seat Reservation"
        hint="Shown instead of the date when set."
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={save.isPending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function InstallmentCreateForm({
  invoiceId,
  onClose,
  onSaved,
  onError,
}: {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (text: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueLabel, setDueLabel] = useState('');
  const save = useMutation({
    mutationFn: () =>
      installmentsApi.create({
        invoiceId,
        label,
        amountPaise: Math.max(0, Math.round(Number(amountRupees) * 100)),
        dueDate,
        dueLabel: dueLabel.trim() || null,
      }),
    onSuccess: () => onSaved(),
    onError: (err) =>
      onError(err instanceof ApiHttpError ? err.message : 'Failed to create.'),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-5 gap-2 items-end bg-surface-muted/40 rounded-xl p-3">
      <Input
        label="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Registration Fee"
        required
      />
      <Input
        label="Amount (₹)"
        type="number"
        min={0}
        value={amountRupees}
        onChange={(e) => setAmountRupees(e.target.value)}
        required
      />
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
      />
      {/* M10x — Milestone overrides the calendar date in the display. */}
      <Input
        label="Milestone (optional)"
        value={dueLabel}
        onChange={(e) => setDueLabel(e.target.value)}
        placeholder="e.g. Seat Reservation"
        hint="Shown instead of the date."
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={save.isPending}>
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// M10x — "Total Fees Specified" card. Mirrors the Excel template's
// upfront declaration. Admin types the expected total at the top; the
// card warns when the actual installment sum drifts from the declared
// value. Null = "not declared, use computed sum".
function DeclaredTotalCard({
  enrolment,
  computedTotalPaise,
}: {
  enrolment: EnrollmentDto;
  computedTotalPaise: number;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string>(
    enrolment.declaredTotalPaise != null
      ? String(Math.round(enrolment.declaredTotalPaise / 100))
      : '',
  );
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      adminEnrollmentsApi.update(enrolment.id, {
        declaredTotalPaise:
          draft.trim() === ''
            ? null
            : Math.max(0, Math.round(Number(draft) * 100)),
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Total Fees Specified saved.' });
      qc.invalidateQueries({ queryKey: ['admin', 'enrollments'] });
    },
    onError: (err) =>
      setMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Failed to save.',
      }),
  });

  const declared = enrolment.declaredTotalPaise;
  const variance =
    declared != null ? computedTotalPaise - declared : null;
  const varianceTone =
    variance == null
      ? 'neutral'
      : Math.abs(variance) < 100
        ? 'success' // < ₹1 difference is rounding noise
        : variance > 0
          ? 'warning' // computed exceeds declared
          : 'danger'; // computed under declared (missing rows)

  return (
    <Card accent="navy">
      <CardHeader
        title="Total Fees Specified"
        subtitle="Upfront declaration from the admission letter / Excel sheet. We warn if the installment sum drifts from this number."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <Input
          label="Declared total (₹)"
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 131500"
          hint="Leave blank to clear."
          className="min-w-[200px]"
        />
        <Button type="submit" size="sm" loading={save.isPending}>
          Save
        </Button>
        {declared != null && (
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-wider text-muted font-bold">
              Variance vs computed
            </p>
            <p
              className={[
                'font-mono font-semibold text-sm',
                varianceTone === 'success' ? 'text-success' : '',
                varianceTone === 'warning' ? 'text-amber-700' : '',
                varianceTone === 'danger' ? 'text-danger' : '',
              ].join(' ')}
            >
              {variance != null && variance !== 0
                ? `${variance > 0 ? '+' : ''}${formatMoney(variance)}`
                : 'matches'}
            </p>
          </div>
        )}
      </form>
      {msg && (
        <div
          role={msg.kind === 'ok' ? 'status' : 'alert'}
          className={`mt-3 rounded-xl p-2.5 text-sm ${
            msg.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-success'
              : 'bg-red-50 border border-danger/30 text-danger'
          }`}
        >
          {msg.text}
        </div>
      )}
      {declared != null && variance != null && Math.abs(variance) >= 100 && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p className="font-medium">
            Declared {formatMoney(declared)} ≠ computed {formatMoney(computedTotalPaise)}.
          </p>
          <p className="text-amber-800/90 mt-0.5">
            Add / edit installments below until the sum matches your declaration.
          </p>
        </div>
      )}
    </Card>
  );
}
