// ── Shared Reliability Mock Data ─────────────────────────────────
// Single source of truth for the 7-dimension reliability score.
// Both the Dashboard and Reliability Center import from here.
// If you change these values, both pages stay in sync automatically.

import type {
  ReliabilityScore,
  TimeoutRetryStats,
  InjectionStats,
  EvalStats,
  BudgetSpend,
  ContextStats,
  SchemaValidationStats,
} from "../types/reliability";

export const MOCK_RELIABILITY: ReliabilityScore = {
  overall: 78,
  dimensions: {
    timeoutsRetries: 85,
    promptInjection: 92,
    testDeterminism: 60,
    costControl: 72,
    contextWindow: 65,
    evalHarness: 55,
    outputTrust: 88,
  },
};

export const MOCK_TIMEOUT_STATS: TimeoutRetryStats = {
  totalCalls: 45823,
  timeoutCount: 312,
  retryCount: 891,
  retrySuccessCount: 714,
  retryFailCount: 177,
  circuitBreakerTrips: 8,
  circuitBreakerHalfOpens: 3,
  currentQueueDepth: 23,
  avgLatencyMs: 1240,
  p95LatencyMs: 4200,
  p99LatencyMs: 8900,
  hungConnectionCount: 4,
  timeSeries: [
    { date: "Jul 01", timeouts: 42, retries: 118, successes: 98 },
    { date: "Jul 02", timeouts: 38, retries: 104, successes: 87 },
    { date: "Jul 03", timeouts: 55, retries: 142, successes: 112 },
    { date: "Jul 04", timeouts: 29, retries: 76, successes: 63 },
    { date: "Jul 05", timeouts: 63, retries: 168, successes: 131 },
    { date: "Jul 06", timeouts: 47, retries: 132, successes: 108 },
    { date: "Jul 07", timeouts: 38, retries: 151, successes: 115 },
  ],
};

export const MOCK_INJECTION: InjectionStats = {
  totalAttempts: 34,
  blockedCount: 28,
  flaggedCount: 6,
  criticalCount: 3,
  topPatterns: [
    { pattern: "Ignore all previous instructions", count: 12 },
    { pattern: "You are now in admin mode", count: 8 },
    { pattern: "Role-play as system", count: 6 },
  ],
  byModel: [
    { model: "GPT-4o", count: 18 },
    { model: "Claude 3.5", count: 12 },
    { model: "GPT-3.5", count: 4 },
  ],
  bySeverity: [
    { severity: "critical", count: 3 },
    { severity: "high", count: 8 },
    { severity: "medium", count: 14 },
    { severity: "low", count: 9 },
  ],
  timeSeries: [
    { date: "Jul 01", count: 5, blocked: 3 },
    { date: "Jul 02", count: 8, blocked: 6 },
    { date: "Jul 03", count: 3, blocked: 2 },
    { date: "Jul 04", count: 11, blocked: 7 },
    { date: "Jul 05", count: 7, blocked: 5 },
    { date: "Jul 06", count: 9, blocked: 6 },
    { date: "Jul 07", count: 4, blocked: 3 },
  ],
};

export const MOCK_SCHEMA: SchemaValidationStats = {
  total: 28491,
  validCount: 27921,
  invalidCount: 570,
  validRate: 98.0,
  topErrors: [
    { errorType: "parse_error", count: 210 },
    { errorType: "missing_field", count: 145 },
    { errorType: "type_error", count: 98 },
    { errorType: "trailing_comma", count: 67 },
  ],
  byModel: [
    { model: "GPT-4o", validRate: 94.2, total: 5230 },
    { model: "Claude 3.5", validRate: 92.8, total: 3840 },
    { model: "GPT-3.5", validRate: 87.5, total: 2340 },
    { model: "Llama 3", validRate: 84.1, total: 1048 },
  ],
  timeSeries: [
    { date: "Jul 01", validRate: 93.2, total: 1780 },
    { date: "Jul 02", validRate: 92.1, total: 1650 },
    { date: "Jul 03", validRate: 90.8, total: 1820 },
    { date: "Jul 04", validRate: 91.4, total: 1590 },
    { date: "Jul 05", validRate: 90.2, total: 1740 },
    { date: "Jul 06", validRate: 91.8, total: 1950 },
    { date: "Jul 07", validRate: 91.6, total: 1888 },
  ],
};

export const MOCK_BUDGET: BudgetSpend = {
  budget: 5000,
  spent: 3806.42,
  projected: 4850.15,
  remaining: 1193.58,
  daysRemaining: 24,
  dailyAvg: 158.60,
  projectedOvershoot: 0,
};

export const MOCK_CONTEXT: ContextStats = {
  totalTraces: 45823,
  truncationCount: 347,
  avgTokenUsage: 3245,
  avgPercentage: 64.8,
  over80PctCount: 8231,
  over95PctCount: 1247,
  byModel: [
    { model: "GPT-4o", avgPercentage: 72, truncations: 189, total: 18230 },
    { model: "Claude 3.5", avgPercentage: 68, truncations: 102, total: 12540 },
    { model: "GPT-3.5", avgPercentage: 55, truncations: 41, total: 9870 },
    { model: "Llama 3", avgPercentage: 48, truncations: 15, total: 5183 },
  ],
  timeSeries: [
    { date: "Jul 01", avgPercentage: 62, truncations: 42 },
    { date: "Jul 02", avgPercentage: 65, truncations: 51 },
    { date: "Jul 03", avgPercentage: 68, truncations: 58 },
    { date: "Jul 04", avgPercentage: 61, truncations: 39 },
    { date: "Jul 05", avgPercentage: 67, truncations: 63 },
    { date: "Jul 06", avgPercentage: 64, truncations: 47 },
    { date: "Jul 07", avgPercentage: 66, truncations: 47 },
  ],
  recentOverflows: [
    { _id: "ctx1", _creationTime: Date.now(), traceId: "trace_ctx_001", model: "GPT-4o", tokenLimit: 128000, tokensUsed: 124500, percentage: 97.3, truncated: true, truncatedTokens: 3500, relevanceScore: 0.42, createdAt: Date.now() - 600000 },
    { _id: "ctx2", _creationTime: Date.now(), traceId: "trace_ctx_002", model: "Claude 3.5", tokenLimit: 100000, tokensUsed: 98200, percentage: 98.2, truncated: true, truncatedTokens: 1800, relevanceScore: 0.38, createdAt: Date.now() - 1800000 },
    { _id: "ctx3", _creationTime: Date.now(), traceId: "trace_ctx_003", model: "GPT-4o", tokenLimit: 128000, tokensUsed: 110500, percentage: 86.3, truncated: false, truncatedTokens: 0, relevanceScore: 0.65, createdAt: Date.now() - 3600000 },
  ],
};

export const MOCK_EVAL: EvalStats = {
  totalRuns: 147,
  currentPassRate: 82.3,
  regressionCount: 6,
  lastRunAt: Date.now() - 3600000,
  passRateHistory: [
    { date: "Jul 01", passRate: 85 },
    { date: "Jul 02", passRate: 82 },
    { date: "Jul 03", passRate: 79 },
    { date: "Jul 04", passRate: 76 },
    { date: "Jul 05", passRate: 80 },
    { date: "Jul 06", passRate: 82.3 },
  ],
  byModel: [
    { model: "GPT-4o", passRate: 82, runs: 14 },
    { model: "Claude 3.5", passRate: 79, runs: 10 },
    { model: "GPT-3.5", passRate: 71, runs: 7 },
    { model: "Llama 3", passRate: 68, runs: 3 },
  ],
  recentRegressions: [
    { _id: "reg1", _creationTime: Date.now(), previousVersion: "v1.2.0", newVersion: "v1.3.0", previousPassRate: 85, newPassRate: 76, delta: -9, severity: "major", model: "GPT-4o", timestamp: Date.now() - 7200000 },
    { _id: "reg2", _creationTime: Date.now(), previousVersion: "v1.1.5", newVersion: "v1.2.0", previousPassRate: 82, newPassRate: 78, delta: -4, severity: "minor", model: "Claude 3.5", timestamp: Date.now() - 172800000 },
  ],
};