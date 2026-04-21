import type { ApiCostProvider, TicketCategory } from '../enums.js';

// M8 — Analytics DTOs (TRD §5.12, PRD §15).
// Summary endpoint returns 7 admin dashboard widgets in one call. Each widget
// is a headline number (or currency, in paise for money fields) plus a 14-day
// daily sparkline array. Target latency <500ms via `analyticsService` in-memory
// 5-minute TTL cache (TRD §6 line 753).

export interface AnalyticsStudentTile {
  active: number;
  suspended: number;
  inTrialToday: number;
}

export interface AnalyticsAdmissionsTile {
  thisMonth: number;
  ytd: number;
}

export interface AnalyticsFeesTile {
  collectedThisMonthPaise: number;
  collectedYtdPaise: number;
  outstandingPaise: number;
}

export interface AnalyticsAssessmentsTile {
  quizPassRatePercent: number;
  examPassRatePercent: number;
  /** Number of attempts the pass-rate is computed over (denominator). */
  samples: number;
}

export interface AnalyticsSlaBreachesTile {
  thisWeek: number;
  byCategory: Record<TicketCategory, number>;
}

export interface AnalyticsFeedbackTile {
  coveragePercent: number;
  publishedLast7d: number;
}

export interface AnalyticsApiCostRow {
  provider: ApiCostProvider;
  units: number;
  totalPaise: number;
}

export interface AnalyticsApiCostTile {
  thisMonthPaise: number;
  byProvider: AnalyticsApiCostRow[];
}

/** Each sparkline is 14 entries: daily counts/amounts ending today (UTC). */
export interface AnalyticsSparkline {
  days: string[]; // ISO date (yyyy-mm-dd) for each bar
  values: number[];
}

export interface AnalyticsSummaryDto {
  generatedAt: string;
  students: AnalyticsStudentTile;
  admissions: AnalyticsAdmissionsTile;
  fees: AnalyticsFeesTile;
  assessments: AnalyticsAssessmentsTile;
  slaBreaches: AnalyticsSlaBreachesTile;
  feedback: AnalyticsFeedbackTile;
  apiCost: AnalyticsApiCostTile;
  sparklines: {
    students: AnalyticsSparkline;
    feesCollected: AnalyticsSparkline;
    slaBreaches: AnalyticsSparkline;
  };
}

export interface CollectionsReportRow {
  day: string; // yyyy-mm-dd
  mode: string;
  component: string;
  amountPaise: number;
  count: number;
}

export interface CollectionsReportDto {
  from: string;
  to: string;
  totalPaise: number;
  rows: CollectionsReportRow[];
}

export interface SlaBreachReportRow {
  category: TicketCategory;
  ackBreaches: number;
  resolveBreaches: number;
  total: number;
}

export interface SlaBreachReportDto {
  week: string; // ISO week yyyy-Www
  weekStart: string;
  weekEnd: string;
  total: number;
  byCategory: SlaBreachReportRow[];
}
