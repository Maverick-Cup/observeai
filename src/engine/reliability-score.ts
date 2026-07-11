/**
 * Reliability Score Engine
 *
 * Computes ObserveAI's 7-dimension Reliability Score from ingested data.
 * Each dimension is scored 0-100 using real formulas (not mocked constants).
 * The overall score is a weighted average (equal weight per dimension, configurable).
 *
 * Usage:
 *   const result = computeReliabilityScore(inputs);
 *   result.overall      // 0-100
 *   result.dimensions   // per-dimension scores
 *   result.trends       // 7-day deltas
 */

import type { ReliabilityScore } from "../types/reliability";

// ── Input shape ───────────────────────────────────────────────────
// Each dimension receives its relevant raw stats.
// These are the contracts the ingestion pipeline must satisfy.

export interface TimeoutRetryInput {
  totalCalls: number;
  timeoutCount: number;
  retryCount: number;
  retrySuccessCount: number;
  circuitBreakerTrips: number;
}

export interface InjectionInput {
  totalAttempts: number;
  blockedCount: number;
  criticalCount: number;
}

export interface TestDeterminismInput {
  totalRuns: number;
  currentPassRate: number; // 0-100
  regressionCount: number;
}

export interface CostControlInput {
  budget: number;
  spent: number;
  projected: number;
}

export interface ContextWindowInput {
  totalTraces: number;
  truncationCount: number;
  over80PctCount: number;
  avgRelevance: number | null; // 0-1, null if unavailable
}

export interface EvalHarnessInput {
  totalRuns: number;
  currentPassRate: number; // 0-100
  regressions: Array<{
    severity: "minor" | "major" | "critical";
    delta: number; // absolute drop in pass rate (0-100)
  }>;
}

export interface OutputTrustInput {
  total: number;
  validCount: number;
  invalidCount: number;
  topErrorCount: number; // count of the most frequent error type
}

export interface ScoreInputs {
  timeoutsRetries: TimeoutRetryInput;
  promptInjection: InjectionInput;
  testDeterminism: TestDeterminismInput;
  costControl: CostControlInput;
  contextWindow: ContextWindowInput;
  evalHarness: EvalHarnessInput;
  outputTrust: OutputTrustInput;
}

export interface DimensionTrend {
  score: number;
  trend: number; // 7-day delta, positive = improving
}

export interface ReliabilityScoreResult extends ReliabilityScore {
  trends: {
    timeoutsRetries: number;
    promptInjection: number;
    testDeterminism: number;
    costControl: number;
    contextWindow: number;
    evalHarness: number;
    outputTrust: number;
  };
  // Per-dimension detail for drill-down
  breakdown: {
    timeoutsRetries: { timeoutRate: number; retrySuccessRate: number; cbTripRate: number };
    promptInjection: { blockRate: number; criticalRate: number };
    testDeterminism: { passRate: number; regressionRatio: number };
    costControl: { spendRatio: number; overshootRatio: number };
    contextWindow: { truncationRate: number; over80PctRate: number; avgRelevance: number };
    evalHarness: { passRate: number; regressionWeight: number };
    outputTrust: { validRate: number; topErrorRate: number };
  };
}

// ── Dimension scorers ────────────────────────────────────────────

function scoreTimeoutsRetries(input: TimeoutRetryInput) {
  const timeoutRate = input.totalCalls > 0 ? input.timeoutCount / input.totalCalls : 0;
  const retrySuccessRate = input.retryCount > 0 ? input.retrySuccessCount / input.retryCount : 1;
  const cbTripRate = input.totalCalls > 0 ? Math.min(input.circuitBreakerTrips / Math.max(1, input.totalCalls / 10000), 1) : 0;

  const score =
    (1 - timeoutRate) * 30 +
    retrySuccessRate * 40 +
    (1 - cbTripRate) * 30;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { timeoutRate, retrySuccessRate, cbTripRate },
  };
}

function scorePromptInjection(input: InjectionInput) {
  if (input.totalAttempts === 0) {
    return { score: 100, breakdown: { blockRate: 1, criticalRate: 0 } };
  }
  const blockRate = input.blockedCount / input.totalAttempts;
  const criticalRate = input.criticalCount / input.totalAttempts;

  const score = blockRate * 50 + (1 - criticalRate) * 50;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { blockRate, criticalRate },
  };
}

function scoreTestDeterminism(input: TestDeterminismInput) {
  const passRate = input.currentPassRate / 100;
  const regressionRatio = input.totalRuns > 0 ? input.regressionCount / input.totalRuns : 0;

  const score = passRate * 70 + (1 - regressionRatio) * 30;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { passRate, regressionRatio },
  };
}

function scoreCostControl(input: CostControlInput) {
  if (input.budget <= 0) return { score: 100, breakdown: { spendRatio: 0, overshootRatio: 0 } };

  const spendRatio = Math.min(input.spent / input.budget, 1);
  const overshootRatio = Math.max(0, Math.min(input.projected / input.budget - 1, 1));

  const score = (1 - spendRatio) * 50 + Math.max(0, 1 - overshootRatio) * 50;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { spendRatio, overshootRatio },
  };
}

function scoreContextWindow(input: ContextWindowInput) {
  if (input.totalTraces === 0) return { score: 100, breakdown: { truncationRate: 0, over80PctRate: 0, avgRelevance: 0.8 } };

  const truncationRate = input.truncationCount / input.totalTraces;
  const over80PctRate = input.over80PctCount / input.totalTraces;
  const avgRelevance = input.avgRelevance ?? 0.7; // default if not tracked yet

  const score =
    (1 - truncationRate) * 40 +
    (1 - over80PctRate) * 30 +
    avgRelevance * 30;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { truncationRate, over80PctRate, avgRelevance },
  };
}

function scoreEvalHarness(input: EvalHarnessInput) {
  const passRate = input.currentPassRate / 100;
  if (input.regressions.length === 0) {
    return { score: Math.round(passRate * 60 + 40), breakdown: { passRate, regressionWeight: 0 } };
  }

  // Weight regressions: critical=1, major=0.6, minor=0.3
  const weightMap = { minor: 0.3, major: 0.6, critical: 1 };
  let totalWeight = 0;
  for (const reg of input.regressions) {
    const severityWeight = weightMap[reg.severity];
    const deltaWeight = Math.min(reg.delta / 100, 1);
    totalWeight += severityWeight * deltaWeight;
  }
  const regressionWeight = Math.min(totalWeight, 1);

  const score = passRate * 60 + (1 - regressionWeight) * 40;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { passRate, regressionWeight },
  };
}

function scoreOutputTrust(input: OutputTrustInput) {
  if (input.total === 0) return { score: 100, breakdown: { validRate: 1, topErrorRate: 0 } };

  const validRate = input.validCount / input.total;
  const topErrorRate = input.invalidCount > 0 ? input.topErrorCount / input.invalidCount : 0;

  const score = validRate * 60 + (1 - topErrorRate) * 40;

  return {
    score: Math.round(Math.min(Math.max(score, 0), 100)),
    breakdown: { validRate, topErrorRate },
  };
}

// ── Trend computation ────────────────────────────────────────────

export interface HistoricalSnapshot {
  timestamp: number; // epoch ms
  overall: number;
  dimensions: ReliabilityScore["dimensions"];
}

/**
 * Compute 7-day trend for each dimension.
 * Positive trend = score is improving.
 * Falls back to 0 if no historical data.
 */
export function computeTrends(
  current: ReliabilityScore["dimensions"],
  history: HistoricalSnapshot[],
  nowMs: number = Date.now(),
): ReliabilityScoreResult["trends"] {
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const closest = history
    .filter((h) => h.timestamp >= sevenDaysAgo)
    .sort((a, b) => b.timestamp - a.timestamp)[0]; // most recent in window

  const keys = Object.keys(current) as Array<keyof typeof current>;
  const trends = {} as ReliabilityScoreResult["trends"];

  for (const key of keys) {
    if (closest) {
      trends[key] = current[key] - closest.dimensions[key];
    } else {
      trends[key] = 0;
    }
  }

  return trends;
}

// ── Main computation ─────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<keyof ReliabilityScore["dimensions"], number> = {
  timeoutsRetries: 1,
  promptInjection: 1,
  testDeterminism: 1,
  costControl: 1,
  contextWindow: 1,
  evalHarness: 1,
  outputTrust: 1,
};

/**
 * Compute the full 7-dimension Reliability Score from raw data inputs.
 * Returns a complete ReliabilityScoreResult with scores, trends, and breakdowns.
 */
export function computeReliabilityScore(
  inputs: ScoreInputs,
  history?: HistoricalSnapshot[],
): ReliabilityScoreResult {
  const t = scoreTimeoutsRetries(inputs.timeoutsRetries);
  const pi = scorePromptInjection(inputs.promptInjection);
  const td = scoreTestDeterminism(inputs.testDeterminism);
  const cc = scoreCostControl(inputs.costControl);
  const cw = scoreContextWindow(inputs.contextWindow);
  const eh = scoreEvalHarness(inputs.evalHarness);
  const ot = scoreOutputTrust(inputs.outputTrust);

  const dimensions = {
    timeoutsRetries: t.score,
    promptInjection: pi.score,
    testDeterminism: td.score,
    costControl: cc.score,
    contextWindow: cw.score,
    evalHarness: eh.score,
    outputTrust: ot.score,
  };

  const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
  const overall = Math.round(
    (Object.keys(dimensions) as Array<keyof typeof dimensions>).reduce(
      (sum, key) => sum + dimensions[key] * DIMENSION_WEIGHTS[key],
      0,
    ) / totalWeight,
  );

  const defaultHistory = history ?? [];
  const trends = computeTrends(dimensions, defaultHistory);

  return {
    overall,
    dimensions,
    trends,
    breakdown: {
      timeoutsRetries: t.breakdown,
      promptInjection: pi.breakdown,
      testDeterminism: td.breakdown,
      costControl: cc.breakdown,
      contextWindow: cw.breakdown,
      evalHarness: eh.breakdown,
      outputTrust: ot.breakdown,
    },
  };
}