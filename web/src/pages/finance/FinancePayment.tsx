import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PaymentMethod } from 'india-learns-shared-types';
import { studentsApi, feesApi, usersApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatMoney, formatIstDate } from '../../lib/format.js';
import { ApiHttpError } from '../../lib/api.js';

const METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'];

export function FinancePaymentNew() {
  const [q, setQ] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const usersQ = useQuery({
    queryKey: ['finance', 'students', q],
    queryFn: () => usersApi.list({ role: 'student', q }),
    enabled: q.length >= 2,
  });
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
    <div className="space-y-4 max-w-3xl">
      <Link to="/finance/dashboard" className="text-sm text-brand-orange hover:underline">← Back to dashboard</Link>
      <h1 className="text-2xl font-bold text-brand-navy">Record a payment</h1>

      <Card>
        <CardHeader title="1 · Find the student" />
        <Input
          placeholder="Search name, email or code (min 2 chars)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setStudentId(null);
          }}
        />
        {q.length >= 2 && usersQ.data && usersQ.data.length > 0 && (
          <ul className="mt-3 divide-y divide-black/5 border border-black/5 rounded-lg max-h-64 overflow-y-auto">
            {usersQ.data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setStudentId(u.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-brand-cream ${studentId === u.id ? 'bg-brand-cream' : ''}`}
                >
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}{u.code && <> · <span className="mono">{u.code}</span></>}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {studentId && (
        <Card>
          <CardHeader title="2 · Confirm outstanding balance" />
          {feesQ.isLoading && <Skeleton lines={3} />}
          {feesQ.isError && <ErrorAlert message={(feesQ.error as Error).message} onRetry={() => feesQ.refetch()} />}
          {feesQ.data && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Total" value={formatMoney(feesQ.data.totalPaise)} />
                <Stat label="Paid" value={formatMoney(feesQ.data.paidPaise)} tone="success" />
                <Stat label="Outstanding" value={formatMoney(feesQ.data.balancePaise)} tone="danger" />
              </div>
              {feesQ.data.installments.length > 0 ? (
                <ul className="text-sm divide-y divide-black/5">
                  {feesQ.data.installments.slice(0, 5).map((inst) => (
                    <li key={inst.id} className="py-2 flex justify-between">
                      <span>{inst.label} · due {formatIstDate(inst.dueDate)}</span>
                      <span className="mono">{formatMoney(inst.balancePaise)}</span>
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

      {studentId && (
        <Card>
          <CardHeader title="3 · Record payment" />
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              label="Amount (₹)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              hint="The system applies oldest-unpaid-first; overpayment creates a credit note."
            />
            <label className="block">
              <span className="block text-sm font-medium text-brand-navy mb-1.5">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <Input label="Reference (UTR / cheque #)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {msg && (
              <div className={`rounded-lg p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-success' : 'bg-red-50 border border-danger/30 text-danger'}`}>
                {msg.text}
              </div>
            )}
            <Button type="submit" loading={record.isPending}>Record payment & issue receipt</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`font-semibold text-lg ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-brand-navy'}`}>{value}</p>
    </div>
  );
}

export function FinancePayments() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">Payments</h1>
      <Card>
        <EmptyState
          title="Payments list coming in M9"
          message="Today the payment recording + receipt flow is wired; list + reverse-within-24h ships with M9 polish."
        />
        <div className="text-center">
          <Badge tone="info">API ready · UI backlog</Badge>
        </div>
      </Card>
    </div>
  );
}
