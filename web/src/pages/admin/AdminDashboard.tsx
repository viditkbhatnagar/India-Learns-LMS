import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { analyticsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert } from '../../components/ui/States.js';
import { formatMoney } from '../../lib/format.js';
import { useAuthStore } from '../../store/auth.js';

export function AdminDashboard() {
  const me = useAuthStore((s) => s.user);
  const query = useQuery({ queryKey: ['analytics', 'summary'], queryFn: analyticsApi.summary });

  if (query.isLoading) return <Skeleton lines={10} />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const d = query.data!;

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
              Live snapshot across admissions, fees, SLA, and assessments.
              Refreshed every 5 minutes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
            <span>Data live as of {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </section>

      {/* Primary metric row — 4 at laptop width. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active students"
          value={d.students.active.toLocaleString()}
          sub={`${d.students.suspended} suspended · ${d.students.inTrialToday} new in 14d`}
          spark={d.sparklines.students.values}
          tone="navy"
        />
        <MetricCard
          label="Admissions this month"
          value={d.admissions.thisMonth.toLocaleString()}
          sub={`${d.admissions.ytd.toLocaleString()} year-to-date`}
          tone="navy"
        />
        <MetricCard
          label="Fees collected"
          value={formatMoney(d.fees.collectedThisMonthPaise)}
          sub={`${formatMoney(d.fees.outstandingPaise)} outstanding`}
          spark={d.sparklines.feesCollected.values}
          tone="orange"
        />
        <MetricCard
          label="SLA breaches (week)"
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
          label="Feedback coverage (7d)"
          value={`${d.feedback.coveragePercent}%`}
          sub={`${d.feedback.publishedLast7d} published`}
          tone="navy"
          subtle
        />
        <MetricCard
          label="API spend (month)"
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
            subtitle="Rolling 7-day window"
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
          <CardHeader title="API spend by provider" subtitle="Month-to-date" />
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
    </div>
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
  const accentBar: Record<MetricTone, string> = {
    navy: 'bg-brand-navy',
    orange: 'bg-brand-orange',
    danger: 'bg-danger',
  };
  const strokeColor: Record<MetricTone, string> = {
    navy: '#1A3A8F',
    orange: '#F58220',
    danger: '#B91C1C',
  };
  const data = (spark ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-elev-1 hover:shadow-elev-2 transition-all duration-200 ease-bounce p-5">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar[tone]}`} aria-hidden />
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`mt-2 font-bold text-brand-navy count-up ${subtle ? 'text-xl' : 'text-2xl'}`}>
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
