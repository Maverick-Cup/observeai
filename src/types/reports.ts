/**
 * Executive Weekly Report types
 */

export interface ReportData {
  id: string;
  title: string;
  weekStart: string; // ISO date
  weekEnd: string;   // ISO date
  generatedAt: number;
  deliveredAt?: number;

  // Summary metrics
  overallScore: number;
  scoreChange: number;         // 7-day delta
  accuracyPercent: number;     // pass rate avg
  accuracyChange: number;
  costPerGoodResponse: number; // $ cost per passing response
  costChange: number;
  totalTraces: number;
  totalGuardrailEvents: number;
  blockCount: number;
  flagCount: number;

  // Per-dimension breakdown
  dimensions: Array<{
    name: string;
    score: number;
    change: number;
    status: "healthy" | "at_risk" | "critical";
  }>;

  // Regression summary
  regressions: Array<{
    dimension: string;
    previousScore: number;
    currentScore: number;
    delta: number;
  }>;

  // Top 3 fix suggestions
  topFixes: Array<{
    dimension: string;
    suggestion: string;
    impact: "high" | "medium" | "low";
  }>;

  // Cost breakdown
  totalCost: number;
  costByModel: Array<{ model: string; cost: number }>;

  // Status
  status: "draft" | "delivered" | "failed";
}

export interface ReportEmailConfig {
  recipients: string[];
  scheduleDay: number;    // 0=Sun, 1=Mon, ..., 6=Sat
  scheduleHour: number;   // 0-23 UTC
  lastDelivered?: number;
  enabled: boolean;
}

export const DEFAULT_REPORT_CONFIG: ReportEmailConfig = {
  recipients: [],
  scheduleDay: 1,    // Monday
  scheduleHour: 9,   // 9AM UTC
  enabled: false,
};