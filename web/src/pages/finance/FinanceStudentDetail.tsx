import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeeInstallmentDto, InvoiceDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { installmentsApi, studentsApi, usersApi } from '../../lib/endpoints.js';
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

  if (userQ.isLoading || feesQ.isLoading) return <Skeleton lines={6} />;
  if (userQ.isError) return <ErrorAlert message={(userQ.error as Error).message} />;
  if (feesQ.isError) return <ErrorAlert message={(feesQ.error as Error).message} />;
  const user = userQ.data!;
  const fees = feesQ.data!;

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
                    {invoiceLabel(inst.invoiceId)} · due {formatIstDate(inst.dueDate)} ·{' '}
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
  const save = useMutation({
    mutationFn: () =>
      installmentsApi.update(installment.id, {
        label,
        amountPaise: Math.max(0, Math.round(Number(amountRupees) * 100)),
        dueDate,
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
    <form onSubmit={submit} className="grid sm:grid-cols-4 gap-2 items-end bg-surface-muted/40 rounded-xl p-3">
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
  const save = useMutation({
    mutationFn: () =>
      installmentsApi.create({
        invoiceId,
        label,
        amountPaise: Math.max(0, Math.round(Number(amountRupees) * 100)),
        dueDate,
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
    <form onSubmit={submit} className="grid sm:grid-cols-4 gap-2 items-end bg-surface-muted/40 rounded-xl p-3">
      <Input
        label="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Seat Reservation"
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
