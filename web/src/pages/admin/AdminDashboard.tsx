import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { AnalyticsSummaryDto } from 'india-learns-shared-types';
import { analyticsApi, programsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { formatMoney } from '../../lib/format.js';
import { useAuthStore } from '../../store/auth.js';

type RangePreset = 'all' | '7d' | '30d' | 'mtd' | 'ytd' | 'custom';

// Resolve a preset to a concrete [from, to] pair in UTC ISO form. `all`
// returns null so the backend falls back to its legacy defaults.
function resolveRange(preset: RangePreset, customFrom: string, customTo: string):
  | { from: string; to: string }
  | null {
  const now = new Date();
  const endOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const startUtcDaysAgo = (n: number) => {
    const d = new Date(endOfToday.getTime() - (n + 1) * 86_400_000);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };
  switch (preset) {
    case '7d':
      return { from: startUtcDaysAgo(7).toISOString(), to: endOfToday.toISOString() };
    case '30d':
      return { from: startUtcDaysAgo(30).toISOString(), to: endOfToday.toISOString() };
    case 'mtd': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from: from.toISOString(), to: endOfToday.toISOString() };
    }
    case 'ytd': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { from: from.toISOString(), to: endOfToday.toISOString() };
    }
    case 'custom': {
      if (!customFrom || !customTo) return null;
      // HTML date input gives "YYYY-MM-DD" — treat as UTC midnight.
      const from = new Date(`${customFrom}T00:00:00Z`);
      const to = new Date(`${customTo}T00:00:00Z`);
      to.setUTCDate(to.getUTCDate() + 1); // inclusive-end
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case 'all':
    default:
      return null;
  }
}

export function AdminDashboard() {
  const me = useAuthStore((s) => s.user);
  const [programId, setProgramId] = useState<string>('all');
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const filtersActive = programId !== 'all' || range !== null;

  const query = useQuery({
    queryKey: ['analytics', 'summary', programId, range?.from ?? null, range?.to ?? null],
    queryFn: () =>
      analyticsApi.summary({
        ...(programId !== 'all' ? { programId } : {}),
        ...(range ? { from: range.from, to: range.to } : {}),
      }),
  });

  const presetLabel: Record<RangePreset, string> = {
    all: 'All time',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    mtd: 'Month to date',
    ytd: 'Year to date',
    custom: 'Custom',
  };
  const rangeLabel = filtersActive
    ? (range
      ? `${new Date(range.from).toLocaleDateString()} – ${new Date(new Date(range.to).getTime() - 86_400_000).toLocaleDateString()}`
      : presetLabel[preset])
    : 'Live defaults';
  const windowHint = range
    ? '(in selected range)'
    : '(this month)';

  const program = programId !== 'all'
    ? programsQ.data?.find((p) => p.id === programId)?.name ?? 'Selected program'
    : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero. */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-brand-gradient text-white shadow-elev-3">
        <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm tracking-wide uppercase">
              {me?.role === 'superadmin' ? 'Superadmin' : 'Admin'} · Analytics
            </p>
            <h1 className="text-display-md mt-1 text-white">
              India Learns
              <span className="text-brand-orange">.</span>
            </h1>
            <p className="mt-3 text-white/80 max-w-xl">
              {program
                ? `${program} · ${rangeLabel}`
                : `Live snapshot across admissions, fees, SLA, and assessments · ${rangeLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
            <span>
              {query.isFetching
                ? 'Refreshing…'
                : `Data live as of ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        </div>
      </section>

      {/* Filter bar. */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <label className="block lg:w-56">
            <span className="block text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
              Program
            </span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="all">All programs</option>
              {(programsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
              Date range
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(['all', '7d', '30d', 'mtd', 'ytd', 'custom'] as RangePreset[]).map((p) => {
                const active = preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={`px-3 h-9 rounded-lg text-xs font-semibold transition-colors border ${
                      active
                        ? 'bg-brand-navy text-white border-brand-navy shadow-elev-1'
                        : 'bg-white text-ink/70 border-black/10 hover:border-black/20 hover:text-brand-navy'
                    }`}
                  >
                    {presetLabel[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {preset === 'custom' && (
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
                  From
                </span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
                  To
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                />
              </label>
            </div>
          )}

          {filtersActive && (
            <Button
              variant="ghost"
              onClick={() => {
                setProgramId('all');
                setPreset('all');
                setCustomFrom('');
                setCustomTo('');
              }}
            >
              Reset
            </Button>
          )}
        </div>
        {filtersActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Filters active:</span>
            {program && <Badge tone="info" dot>{program}</Badge>}
            {range && (
              <Badge tone="accent" dot>
                {rangeLabel}
              </Badge>
            )}
          </div>
        )}
      </Card>

      {query.isLoading && <Skeleton variant="card" />}
      {query.isError && (
        <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />
      )}
      {query.data && (
        <AnalyticsBody d={query.data} windowHint={windowHint} />
      )}
    </div>
  );
}

function AnalyticsBody({
  d,
  windowHint,
}: {
  d: AnalyticsSummaryDto;
  windowHint: string;
}) {
  return (
    <>
      {/* Primary metric row — 4 at laptop width. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active students"
          value={d.students.active.toLocaleString()}
          sub={`${d.students.suspended} suspended · ${d.students.inTrialToday} new ${windowHint === '(this month)' ? 'in 14d' : windowHint}`}
          spark={d.sparklines.students.values}
          tone="navy"
        />
        <MetricCard
          label={`Admissions ${windowHint}`}
          value={d.admissions.thisMonth.toLocaleString()}
          sub={`${d.admissions.ytd.toLocaleString()} year-to-date`}
          tone="navy"
        />
        <MetricCard
          label={`Fees collected ${windowHint}`}
          value={formatMoney(d.fees.collectedThisMonthPaise)}
          sub={`${formatMoney(d.fees.outstandingPaise)} outstanding`}
          spark={d.sparklines.feesCollected.values}
          tone="orange"
        />
        <MetricCard
          label={`SLA breaches ${windowHint === '(this month)' ? '(week)' : windowHint}`}
          value={d.slaBreaches.thisWeek.toLocaleString()}
          sub="Across all ticket categories"
          spark={d.sparklines.slaBreaches.values}
          tone={d.slaBreaches.thisWeek > 0 ? 'danger' : 'navy'}
        />
      </div>

      {/* Secondary row — 3. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Quiz pass rate"
          value={`${d.assessments.quizPassRatePercent}%`}
          sub={`Exam ${d.assessments.examPassRatePercent}% · ${d.assessments.samples} attempts`}
          tone="navy"
          subtle
        />
        <MetricCard
          label="Feedback coverage"
          value={`${d.feedback.coveragePercent}%`}
          sub={`${d.feedback.publishedLast7d} published`}
          tone="navy"
          subtle
        />
        <MetricCard
          label={`API spend ${windowHint}`}
          value={formatMoney(d.apiCost.thisMonthPaise, { showPaise: true })}
          sub={d.apiCost.byProvider.map((r) => `${r.provider} ${r.units}`).join(' · ')}
          tone="navy"
          subtle
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        {/* SLA by category */}
        <Card accent="navy">
          <CardHeader
            title="SLA breaches by category"
            subtitle={windowHint === '(this month)' ? 'Rolling 7-day window' : `Selected range ${windowHint}`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(Object.entries(d.slaBreaches.byCategory) as Array<[string, number]>).map(([cat, count]) => (
              <div
                key={cat}
                className={`rounded-xl border p-4 transition-colors ${
                  count > 0
                    ? 'border-danger/20 bg-red-50/60'
                    : 'border-black/5 bg-surface-muted'
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">{cat}</p>
                <p
                  className={`text-2xl font-bold mt-2 count-up ${
                    count > 0 ? 'text-danger' : 'text-brand-navy'
                  }`}
                >
                  {count}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* API spend list */}
        <Card accent="orange">
          <CardHeader title="API spend by provider" subtitle={windowHint} />
          <ul className="divide-y divide-black/5">
            {d.apiCost.byProvider.map((r) => (
              <li key={r.provider} className="py-3 flex items-center justify-between">
                <span className="font-medium text-brand-navy capitalize">{r.provider}</span>
                <span className="text-sm text-muted font-mono">
                  {r.units} · {formatMoney(r.totalPaise, { showPaise: true })}
                </span>
              </li>
            ))}
            {d.apiCost.byProvider.length === 0 && (
              <li className="py-6 text-center text-muted text-sm">No API usage recorded yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}

type MetricTone = 'navy' | 'orange' | 'danger';

function MetricCard({
  label,
  value,
  sub,
  spark,
  tone,
  subtle,
}: {
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  tone: MetricTone;
  subtle?: boolean;
}) {
  const numberTone: Record<MetricTone, string> = {
    navy: 'text-brand-navy',
    orange: 'text-brand-orange',
    danger: 'text-danger',
  };
  const strokeColor: Record<MetricTone, string> = {
    navy: '#1A3A8F',
    orange: '#F58220',
    danger: '#B91C1C',
  };
  const data = (spark ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-elev-1 hover:shadow-elev-2 transition-all duration-200 ease-decel p-5">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`mt-2 font-bold font-mono tabular-nums count-up ${numberTone[tone]} ${subtle ? 'text-xl' : 'text-2xl'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {spark && data.length > 0 && !subtle && (
        <div className="h-12 -mx-2 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor[tone]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={strokeColor[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={strokeColor[tone]}
                strokeWidth={2}
                fill={`url(#spark-${tone})`}
                isAnimationActive={false}
              />
              <XAxis dataKey="i" hide />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 4px 8px -2px rgba(15,26,46,0.1)',
                }}
                formatter={(v) => [String(v), '']}
                labelFormatter={() => ''}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {spark && data.length > 0 && subtle && (
        <div className="h-8 -mx-2 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={strokeColor[tone]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
