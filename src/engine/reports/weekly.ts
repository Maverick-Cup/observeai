/**
 * Weekly Report Generator — aggregates reliability data from the last 7 days
 * and produces a structured ReportData object.
 */

import { type ReportData } from "../../types/reports";
import { generateFixSuggestions } from "../fix-suggestions";
import {
  MOCK_RELIABILITY,
  MOCK_EVAL,
  MOCK_BUDGET,
  MOCK_TIMEOUT_STATS,
  MOCK_INJECTION,
  MOCK_CONTEXT,
  MOCK_SCHEMA,
} from "../../data/reliability-data";

// ── Helpers ────────────────────────────────────────────────────────

function getWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  // Move to end of current day
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// ── Generator ──────────────────────────────────────────────────────

export function generateWeeklyReport(
  existingReports: ReportData[] = [],
): ReportData {
  const now = new Date();
  const { start, end } = getWeekRange(now);

  const dimNames: Record<string, string> = {
    timeoutsRetries: "Timeouts & Retries",
    promptInjection: "Prompt Injection Defense",
    testDeterminism: "Test Determinism",
    costControl: "Cost Control",
    contextWindow: "Context Window",
    evalHarness: "Eval Harness",
    outputTrust: "Output Trust",
  };

  const dimStatus = (score: number): "healthy" | "at_risk" | "critical" => {
    if (score >= 80) return "healthy";
    if (score >= 60) return "at_risk";
    return "critical";
  };

  const dimensions = Object.entries(MOCK_RELIABILITY.dimensions).map(([key, score]) => ({
    name: dimNames[key] ?? key,
    score,
    change: randomBetween(-5, 5), // simulated weekly delta
    status: dimStatus(score),
  }));

  const regressions = dimensions
    .filter((d) => d.change < 0)
    .slice(0, 3)
    .map((d) => ({
      dimension: d.name,
      previousScore: Math.min(100, d.score - d.change),
      currentScore: d.score,
      delta: d.change,
    }));

  // Cost breakdown
  const totalCost = MOCK_BUDGET.spent;
  const costByModel = [
    { model: "GPT-4o", cost: totalCost * 0.45 },
    { model: "Claude 3.5", cost: totalCost * 0.30 },
    { model: "GPT-3.5", cost: totalCost * 0.15 },
    { model: "Llama 3", cost: totalCost * 0.10 },
  ];

  // Fix suggestions from the existing engine
  const fixResults = generateFixSuggestions({
    scores: MOCK_RELIABILITY.dimensions,
    rawInputs: {
      timeoutsRetries: {
        totalCalls: MOCK_TIMEOUT_STATS.totalCalls,
        timeoutCount: MOCK_TIMEOUT_STATS.timeoutCount,
        retryCount: MOCK_TIMEOUT_STATS.retryCount,
        retrySuccessCount: MOCK_TIMEOUT_STATS.retrySuccessCount,
        circuitBreakerTrips: MOCK_TIMEOUT_STATS.circuitBreakerTrips,
      },
      promptInjection: {
        totalAttempts: MOCK_INJECTION.totalAttempts,
        blockedCount: MOCK_INJECTION.blockedCount,
        criticalCount: MOCK_INJECTION.criticalCount,
      },
      testDeterminism: {
        totalRuns: MOCK_EVAL.totalRuns,
        currentPassRate: MOCK_EVAL.currentPassRate,
        regressionCount: MOCK_EVAL.regressionCount,
      },
      costControl: {
        budget: MOCK_BUDGET.budget,
        spent: MOCK_BUDGET.spent,
        projected: MOCK_BUDGET.projected,
      },
      contextWindow: {
        totalTraces: MOCK_CONTEXT.totalTraces,
        truncationCount: MOCK_CONTEXT.truncationCount,
        over80PctCount: MOCK_CONTEXT.over80PctCount,
        avgRelevance: null,
      },
      evalHarness: {
        totalRuns: MOCK_EVAL.totalRuns,
        currentPassRate: MOCK_EVAL.currentPassRate,
        regressions: MOCK_EVAL.recentRegressions.map((r) => ({
          severity: r.severity === "major" ? "major" as const : "minor" as const,
          delta: Math.abs(r.delta),
        })),
      },
      outputTrust: {
        total: MOCK_SCHEMA.total,
        validCount: MOCK_SCHEMA.validCount,
        invalidCount: MOCK_SCHEMA.invalidCount,
        topErrorCount: MOCK_SCHEMA.topErrors.length > 0 ? MOCK_SCHEMA.topErrors[0].count : 0,
      },
    },
  });
  const topFixes = fixResults.slice(0, 3).map((f) => ({
    dimension: dimNames[f.dimension] ?? f.dimension,
    suggestion: f.action,
    impact: (f.severity === "critical"
      ? "high"
      : f.severity === "warning"
        ? "medium"
        : "low") as "high" | "medium" | "low",
  }));

  const totalTraces = 45823 + Math.floor(Math.random() * 2000);
  const totalGuardrailEvents = 12 + Math.floor(Math.random() * 8);
  const blockCount = 3 + Math.floor(Math.random() * 4);
  const flagCount = totalGuardrailEvents - blockCount;

  // Score change from last report's overall
  const lastReport = existingReports.length > 0
    ? existingReports[existingReports.length - 1]
    : null;
  const scoreChange = lastReport
    ? MOCK_RELIABILITY.overall - lastReport.overallScore
    : randomBetween(-3, 5);

  return {
    id: `rpt-${formatDate(start)}`,
    title: `Weekly Reliability Report: ${formatDate(start)} – ${formatDate(end)}`,
    weekStart: formatDate(start),
    weekEnd: formatDate(end),
    generatedAt: Date.now(),

    overallScore: MOCK_RELIABILITY.overall,
    scoreChange,
    accuracyPercent: MOCK_EVAL.currentPassRate,
    accuracyChange: randomBetween(-5, 3),
    costPerGoodResponse: randomBetween(0.02, 0.08),
    costChange: randomBetween(-0.02, 0.03),
    totalTraces,
    totalGuardrailEvents,
    blockCount,
    flagCount,

    dimensions,
    regressions,
    topFixes,
    totalCost,
    costByModel,

    status: "draft",
  };
}