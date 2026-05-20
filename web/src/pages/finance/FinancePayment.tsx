import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { PaymentMethod, UserPublicDto } from 'india-learns-shared-types';
import { studentsApi, feesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { UserPicker } from '../../components/ui/UserPicker.js';
import { formatMoney, formatIstDate } from '../../lib/format.js';
import { ApiHttpError } from '../../lib/api.js';

const METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'];

export function FinancePaymentNew() {
  // M10w — Replaced the text-input + result-list with a real combobox
  // (UserPicker). Click to open, type to filter, pick to select.
  const [student, setStudent] = useState<UserPublicDto | null>(null);
  const studentId = student?.id ?? null;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const feesQ = useQuery({
    queryKey: ['finance', 'student-fees', studentId],
    queryFn: () => studentsApi.feesFor(studentId!),
    enabled: Boolean(studentId),
  });
  const record = useMutation({
    mutationFn: () =>
      feesApi.recordPayment({
        studentId: studentId!,
        amountPaise: Math.round(Number(amount) * 100),
        method,
        reference,
        notes,
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Payment recorded.' });
      setAmount('');
      setReference('');
      setNotes('');
      feesQ.refetch();
    },
    onError: (err) => setMsg({ kind: 'err', text: err instanceof ApiHttpError ? err.message : 'Failed' }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!studentId || !amount) return;
    record.mutate();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Finance"
        title="Record a payment"
        subtitle="Find the student, confirm the outstanding balance, then record the payment."
        back={{ to: '/finance/dashboard', label: 'Back to dashboard' }}
      />

      {/* Step 1 — UserPicker combobox. */}
      <Card accent="navy">
        <CardHeader
          title="1 · Find the student"
          subtitle="Click the picker, then type to filter by name, email, or student code."
        />
        <div className="relative">
          <UserPicker
            label="Student"
            placeholder="Pick a student…"
            role="student"
            value={student}
            onChange={setStudent}
            required
          />
        </div>
      </Card>

      {/* Step 2 */}
      {studentId && (
        <Card accent="navy">
          <CardHeader title="2 · Confirm outstanding balance" />
          {feesQ.isLoading && <Skeleton lines={3} />}
          {feesQ.isError && (
            <ErrorAlert
              message={(feesQ.error as Error).message}
              onRetry={() => feesQ.refetch()}
            />
          )}
          {feesQ.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total" value={formatMoney(feesQ.data.totalPaise)} />
                <Stat label="Paid" value={formatMoney(feesQ.data.paidPaise)} tone="success" />
                <Stat
                  label="Outstanding"
                  value={formatMoney(feesQ.data.balancePaise)}
                  tone={feesQ.data.balancePaise > 0 ? 'danger' : 'default'}
                />
              </div>
              {feesQ.data.installments.length > 0 ? (
                <ul className="text-sm divide-y divide-black/5 border border-black/5 rounded-xl overflow-hidden">
                  {feesQ.data.installments.slice(0, 5).map((inst) => (
                    <li
                      key={inst.id}
                      className="py-2.5 px-3.5 flex justify-between items-center bg-white"
                    >
                      <div>
                        <p className="font-medium text-brand-navy">{inst.label}</p>
                        <p className="text-xs text-muted">due {formatIstDate(inst.dueDate)}</p>
                      </div>
                      <span className="font-mono font-semibold">
                        {formatMoney(inst.balancePaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No installments" />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Step 3 */}
      {studentId && (
        <Card accent="orange">
          <CardHeader title="3 · Record payment" />
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Amount (₹)"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              hint="Applied oldest-unpaid-first; overpayment creates a credit note."
            />
            <label className="block">
              <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
                Method
              </span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all capitalize"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Reference (UTR / cheque #)"
              placeholder="Optional"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <Input
              label="Notes"
              placeholder="Internal note (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {msg && (
              <div
                role={msg.kind === 'ok' ? 'status' : 'alert'}
                className={`rounded-xl p-3 text-sm ${
                  msg.kind === 'ok'
                    ? 'bg-emerald-50 border border-emerald-200 text-success'
                    : 'bg-red-50 border border-danger/30 text-danger'
                }`}
              >
                {msg.text}
              </div>
            )}
            <Button type="submit" size="lg" loading={record.isPending}>
              Record payment & issue receipt
            </Button>
          </form>
        </Card>
      )}
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
  tone?: 'danger' | 'success' | 'default';
}) {
  const textColor =
    tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-brand-navy';
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`mt-1 font-bold text-lg font-mono tabular-nums count-up ${textColor}`}>
        {value}
      </p>
    </div>
  );
}

export function FinancePayments() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        subtitle="Full payments ledger with reverse-within-24h ships with M9 polish."
      />
      <Card>
        <EmptyState
          title="Payments list coming soon"
          message="Payment recording + receipt generation are fully wired today; this list surface is next."
          action={<Badge tone="info">API ready · UI backlog</Badge>}
        />
      </Card>
    </div>
  );
}
