// Reliability & Observability type definitions
// Added as part of the 7-failure-mode coverage upgrade

export interface ReliabilityScore {
  overall: number; // 0-100
  dimensions: {
    timeoutsRetries: number;
    promptInjection: number;
    testDeterminism: number;
    costControl: number;
    contextWindow: number;
    evalHarness: number;
    outputTrust: number;
  };
}

export interface InjectionEvent {
  _id: string;
  _creationTime: number;
  traceId: string;
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
  blocked: boolean;
  content: string;
  model: string;
  timestamp: number;
}

export interface InjectionStats {
  totalAttempts: number;
  blockedCount: number;
  flaggedCount: number;
  criticalCount: number;
  topPatterns: { pattern: string; count: number }[];
  byModel: { model: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  timeSeries: { date: string; count: number; blocked: number }[];
}

export interface EvalRun {
  _id: string;
  _creationTime: number;
  promptVersion: string;
  model: string;
  passCount: number;
  failCount: number;
  total: number;
  passRate: number;
  avgScore: number;
  durationMs: number;
  status: "running" | "passed" | "failed" | "regressed";
  triggeredBy: string;
  createdAt: number;
}

export interface EvalRegression {
  _id: string;
  _creationTime: number;
  previousVersion: string;
  newVersion: string;
  previousPassRate: number;
  newPassRate: number;
  delta: number;
  severity: "minor" | "major" | "critical";
  model: string;
  timestamp: number;
}

export interface EvalStats {
  totalRuns: number;
  currentPassRate: number;
  regressionCount: number;
  lastRunAt: number | null;
  passRateHistory: { date: string; passRate: number }[];
  byModel: { model: string; passRate: number; runs: number }[];
  recentRegressions: EvalRegression[];
}

export interface ContextUsage {
  _id: string;
  _creationTime: number;
  traceId: string;
  model: string;
  tokenLimit: number;
  tokensUsed: number;
  percentage: number;
  truncated: boolean;
  truncatedTokens: number;
  relevanceScore: number | null;
  createdAt: number;
}

export interface ContextStats {
  totalTraces: number;
  truncationCount: number;
  avgTokenUsage: number;
  avgPercentage: number;
  over80PctCount: number;
  over95PctCount: number;
  byModel: { model: string; avgPercentage: number; truncations: number; total: number }[];
  timeSeries: { date: string; avgPercentage: number; truncations: number }[];
  recentOverflows: ContextUsage[];
}

export interface BudgetConfig {
  _id: string;
  projectId: string;
  monthlyBudget: number;
  alertThreshold: number; // 0-100, e.g. 80 = alert at 80%
  hardCap: number | null; // null = no hard cap
  createdAt: number;
  updatedAt: number;
}

export interface BudgetSpend {
  budget: number;
  spent: number;
  projected: number;
  remaining: number;
  daysRemaining: number;
  dailyAvg: number;
  projectedOvershoot: number;
}

export interface SchemaValidation {
  _id: string;
  _creationTime: number;
  traceId: string;
  model: string;
  valid: boolean;
  errorType: "parse_error" | "missing_field" | "type_error" | "enum_error" | "trailing_comma" | "truncated_json" | null;
  errorMessage: string | null;
  expectedSchema: string;
  createdAt: number;
}

export interface SchemaValidationStats {
  total: number;
  validCount: number;
  invalidCount: number;
  validRate: number;
  topErrors: { errorType: string; count: number }[];
  byModel: { model: string; validRate: number; total: number }[];
  timeSeries: { date: string; validRate: number; total: number }[];
}

export interface TimeoutRetryConfig {
  timeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  jitterEnabled: boolean;
}

export interface TimeoutRetryStats {
  totalCalls: number;
  timeoutCount: number;
  retryCount: number;
  retrySuccessCount: number;
  retryFailCount: number;
  circuitBreakerTrips: number;
  circuitBreakerHalfOpens: number;
  currentQueueDepth: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  hungConnectionCount: number;
  timeSeries: { date: string; timeouts: number; retries: number; successes: number }[];
}