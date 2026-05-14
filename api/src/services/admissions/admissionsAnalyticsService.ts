import type {
  AdmissionsAnalyticsDto,
  ApplicationState,
} from 'india-learns-shared-types';
import {
  Application,
  ApplicationDraft,
  Program,
} from '../../models/index.js';

// M8 — Admissions funnel analytics.
//
// Tallies application state counts globally + per program, computes the
// time-from-submit-to-decision distribution (p50 / p95), and reports
// per-step draft drop-off.

const ALL_STATES: ApplicationState[] = [
  'draft',
  'submitted',
  'under_review',
  'decision_pending',
  'admitted',
  'denied',
  'waitlisted',
  'withdrawn',
];

function emptyCounts(): AdmissionsAnalyticsDto['totals'] {
  return {
    draft: 0,
    submitted: 0,
    under_review: 0,
    decision_pending: 0,
    admitted: 0,
    denied: 0,
    waitlisted: 0,
    withdrawn: 0,
  };
}

export async function buildAdmissionsAnalytics(): Promise<AdmissionsAnalyticsDto> {
  // Global totals — one Mongo aggregate.
  const globalTotalsRaw = await Application.aggregate<{ _id: ApplicationState; n: number }>([
    { $group: { _id: '$state', n: { $sum: 1 } } },
  ]);
  const totals = emptyCounts();
  for (const row of globalTotalsRaw) {
    if (ALL_STATES.includes(row._id)) totals[row._id] = row.n;
  }

  // Per-program totals — group by programId then enrich with program name.
  const byProgramRaw = await Application.aggregate<{
    _id: { programId: unknown; state: ApplicationState };
    n: number;
  }>([
    { $match: { programId: { $ne: null } } },
    { $group: { _id: { programId: '$programId', state: '$state' }, n: { $sum: 1 } } },
  ]);
  const byProgramMap = new Map<string, AdmissionsAnalyticsDto['totals']>();
  for (const row of byProgramRaw) {
    const pid = String(row._id.programId);
    if (!byProgramMap.has(pid)) byProgramMap.set(pid, emptyCounts());
    if (ALL_STATES.includes(row._id.state)) byProgramMap.get(pid)![row._id.state] = row.n;
  }
  const programIds = Array.from(byProgramMap.keys());
  const programs = programIds.length
    ? await Program.find({ _id: { $in: programIds } }).select('_id name')
    : [];
  const programNameById = new Map(programs.map((p) => [String(p._id), p.name]));
  const byProgram = programIds.map((pid) => ({
    programId: pid,
    programName: programNameById.get(pid) ?? '(unknown)',
    counts: byProgramMap.get(pid)!,
  }));

  // Time-to-decision — only applications that have both submittedAt and a
  // terminal decision. Compute the gap in hours, then p50 / p95.
  const decided = await Application.find(
    {
      submittedAt: { $ne: null },
      'decision.decidedAt': { $ne: null },
    },
    { submittedAt: 1, decision: 1 },
  ).limit(5000);
  const gapHours = decided
    .map((d) => {
      const s = d.submittedAt?.getTime() ?? 0;
      const e = d.decision.decidedAt?.getTime() ?? 0;
      return e > s ? (e - s) / (1000 * 60 * 60) : 0;
    })
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const timeToDecision = {
    p50Hours: percentile(gapHours, 50),
    p95Hours: percentile(gapHours, 95),
    sampleSize: gapHours.length,
  };

  // Drop-off — count how many drafts reached each step.
  const dropOffRaw = await ApplicationDraft.aggregate<{ _id: string; n: number }>([
    { $unwind: '$completedSteps' },
    { $group: { _id: '$completedSteps', n: { $sum: 1 } } },
  ]);
  const dropOffMap = new Map(dropOffRaw.map((r) => [r._id, r.n]));
  const STEPS = [
    'step2_personal',
    'step3_contact',
    'step4_program',
    'step5_academic',
    'step6_documents',
    'step7_statement',
    'step8_references',
    'step9_consents',
  ];
  const dropOff = STEPS.map((step) => ({
    step,
    reachedCount: dropOffMap.get(step) ?? 0,
  }));

  return {
    totals,
    byProgram,
    timeToDecision,
    dropOff,
    generatedAt: new Date().toISOString(),
  };
}

function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return Math.round((sorted[idx] ?? 0) * 10) / 10;
}

export function analyticsToCsv(dto: AdmissionsAnalyticsDto): string {
  const lines: string[] = [];
  lines.push('section,key,value');
  lines.push(`generated_at,,${dto.generatedAt}`);
  for (const [state, count] of Object.entries(dto.totals)) {
    lines.push(`totals,${state},${count}`);
  }
  for (const p of dto.byProgram) {
    for (const [state, count] of Object.entries(p.counts)) {
      lines.push(`by_program,${p.programName} (${state}),${count}`);
    }
  }
  lines.push(`time_to_decision,p50_hours,${dto.timeToDecision.p50Hours ?? ''}`);
  lines.push(`time_to_decision,p95_hours,${dto.timeToDecision.p95Hours ?? ''}`);
  lines.push(`time_to_decision,sample_size,${dto.timeToDecision.sampleSize}`);
  for (const d of dto.dropOff) {
    lines.push(`drop_off,${d.step},${d.reachedCount}`);
  }
  return lines.join('\n');
}
