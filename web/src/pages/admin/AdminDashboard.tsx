import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { analyticsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert } from '../../components/ui/States.js';
import { formatMoney } from '../../lib/format.js';

export function AdminDashboard() {
  const query = useQuery({ queryKey: ['analytics', 'summary'], queryFn: analyticsApi.summary });

  if (query.isLoading) return <Skeleton lines={10} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const d = query.data!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Admin dashboard</h1>
        <p className="text-muted text-sm mt-1">Snapshot of India Learns — auto-refreshed every 5 min.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Active students"
          value={d.students.active.toLocaleString()}
          sub={`${d.students.suspended} suspended · ${d.students.inTrialToday} new in 14d`}
          spark={d.sparklines.students.values}
        />
        <MetricTile
          label="Admissions this month"
          value={d.admissions.thisMonth.toLocaleString()}
          sub={`${d.admissions.ytd} YTD`}
        />
        <MetricTile
          label="Fees collected (month)"
          value={formatMoney(d.fees.collectedThisMonthPaise)}
          sub={`${formatMoney(d.fees.collectedYtdPaise)} YTD · ${formatMoney(d.fees.outstandingPaise)} outstanding`}
          spark={d.sparklines.feesCollected.values}
        />
        <MetricTile
          label="SLA breaches this week"
          value={d.slaBreaches.thisWeek.toLocaleString()}
          sub="Across all ticket categories"
          spark={d.sparklines.slaBreaches.values}
          emphasis={d.slaBreaches.thisWeek > 0 ? 'danger' : 'ok'}
        />
        <MetricTile
          label="Quiz pass rate"
          value={`${d.assessments.quizPassRatePercent}%`}
          sub={`Exam ${d.assessments.examPassRatePercent}% · ${d.assessments.samples} attempts`}
        />
        <MetricTile
          label="Feedback coverage (7d)"
          value={`${d.feedback.coveragePercent}%`}
          sub={`${d.feedback.publishedLast7d} published`}
        />
        <MetricTile
          label="API spend (month)"
          value={formatMoney(d.apiCost.thisMonthPaise, { showPaise: true })}
          sub={d.apiCost.byProvider.map((r) => `${r.provider} ${r.units}`).join(' · ')}
        />
      </div>

      <Card>
        <CardHeader title="SLA breaches by category (this week)" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(Object.entries(d.slaBreaches.byCategory) as Array<[string, number]>).map(([cat, count]) => (
            <div key={cat} className="rounded-lg border border-black/5 bg-brand-cream/40 p-3">
              <p className="text-xs uppercase tracking-wider text-muted font-semibold">{cat}</p>
              <p className={`text-xl font-semibold mt-1 ${count > 0 ? 'text-danger' : 'text-brand-navy'}`}>{count}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="API spend by provider (month)" />
        <ul className="divide-y divide-black/5">
          {d.apiCost.byProvider.map((r) => (
            <li key={r.provider} className="py-2 flex items-center justify-between">
              <span className="capitalize">{r.provider}</span>
              <span className="mono">{r.units} units · {formatMoney(r.totalPaise, { showPaise: true })}</span>
            </li>
          ))}
          {d.apiCost.byProvider.length === 0 && (
            <li className="py-3 text-muted text-sm">No API usage recorded yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  spark,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  emphasis?: 'ok' | 'danger';
}) {
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  const colour = emphasis === 'danger' ? '#C23B3B' : '#F58220';
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className="text-2xl font-bold text-brand-navy mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      {spark && data.length > 0 && (
        <div className="h-10 -mx-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={colour} strokeWidth={2} dot={false} />
              <XAxis dataKey="i" hide />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [String(v), '']} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
