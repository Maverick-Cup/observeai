import { useState, useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ReliabilityGauge } from "../components/ui/ReliabilityGauge";
import { ContextWindowBar } from "../components/ui/ContextWindowBar";
import { InjectionFlagBadge } from "../components/ui/InjectionFlagBadge";
import { BudgetProgressBar } from "../components/ui/BudgetProgressBar";
import { SchemaValidationBadge } from "../components/ui/SchemaValidationBadge";
import { EvalRunStatus, EvalRegressionBadge } from "../components/ui/EvalRunStatus";
import { Button } from "../components/ui/Button";
import {
  Activity,
  Clock,
  ShieldAlert,
  FlaskConical,
  DollarSign,
  Maximize2,
  Code,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lightbulb,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  computeReliabilityScore,
  type ScoreInputs,
} from "../engine/reliability-score";
import {
  generateFixSuggestions,
  type FixSuggestion,
} from "../engine/fix-suggestions";
import {
  MOCK_TIMEOUT_STATS,
  MOCK_INJECTION,
  MOCK_EVAL,
  MOCK_BUDGET,
  MOCK_CONTEXT,
  MOCK_SCHEMA,
} from "../data/reliability-data";
import type { ReliabilityScore } from "../types/reliability";

// ── Dimension card config ─────────────────────────────────────
const DIMENSIONS: Array<{
  key: keyof ReliabilityScore["dimensions"];
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}> = [
  { key: "timeoutsRetries", label: "Timeouts & Retries", icon: Clock, description: "Queue health, circuit breaker, hung connections", color: "bg-blue-500/20 text-blue-500" },
  { key: "promptInjection", label: "Prompt Injection", icon: ShieldAlert, description: "Injection attempts, blocked vs flagged", color: "bg-purple-500/20 text-purple-500" },
  { key: "testDeterminism", label: "Test Determinism", icon: FlaskConical, description: "Eval pass rate, regression count", color: "bg-amber-500/20 text-amber-500" },
  { key: "costControl", label: "Cost Control", icon: DollarSign, description: "Budget vs actual, forecast", color: "bg-green-500/20 text-green-500" },
  { key: "contextWindow", label: "Context Window", icon: Maximize2, description: "Token usage, truncation events", color: "bg-cyan-500/20 text-cyan-500" },
  { key: "evalHarness", label: "Eval Harness", icon: Activity, description: "Prompt version tracking, regressions", color: "bg-rose-500/20 text-rose-500" },
  { key: "outputTrust", label: "Output Trust", icon: Code, description: "Schema validation, hallucination scores", color: "bg-indigo-500/20 text-indigo-500" },
];

// ── Main page ─────────────────────────────────────────────────
export default function Reliability() {
  const [selectedDim, setSelectedDim] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Build ScoreInputs from the mock data sources (swap these for real ingestion data)
  const scoreInputs: ScoreInputs = useMemo(() => ({
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
      avgRelevance: null, // not available from mock context data
    },
    evalHarness: {
      totalRuns: MOCK_EVAL.totalRuns,
      currentPassRate: MOCK_EVAL.currentPassRate,
      regressions: MOCK_EVAL.recentRegressions.map(r => ({
        severity: r.severity as "minor" | "major" | "critical",
        delta: r.delta,
      })),
    },
    outputTrust: {
      total: MOCK_SCHEMA.total,
      validCount: MOCK_SCHEMA.validCount,
      invalidCount: MOCK_SCHEMA.invalidCount,
      topErrorCount: MOCK_SCHEMA.topErrors[0]?.count ?? 0,
    },
  }), []);

  const scoreResult = useMemo(() => computeReliabilityScore(scoreInputs), [scoreInputs]);
  const suggestions = useMemo(() => generateFixSuggestions({
    scores: scoreResult.dimensions,
    rawInputs: scoreInputs,
  }), [scoreResult, scoreInputs]);

  const dimensionDetails = (key: string) => {
    switch (key) {
      case "timeoutsRetries":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Calls wrapped with timeouts and retries prevent hung connections from cascading into full outages.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{MOCK_TIMEOUT_STATS.timeoutCount}</p><p className="text-[10px] text-muted-foreground">Timeouts</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{MOCK_TIMEOUT_STATS.retryCount}</p><p className="text-[10px] text-muted-foreground">Retries</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-success">{MOCK_TIMEOUT_STATS.retrySuccessCount}</p><p className="text-[10px] text-muted-foreground">Retry Success</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{MOCK_TIMEOUT_STATS.retryFailCount}</p><p className="text-[10px] text-muted-foreground">Retry Failed</p></div></Card>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><div className="p-3 text-center"><p className="text-lg font-bold text-warning">{MOCK_TIMEOUT_STATS.circuitBreakerTrips}</p><p className="text-[10px] text-muted-foreground">CB Trips</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-lg font-bold text-warning">{MOCK_TIMEOUT_STATS.currentQueueDepth}</p><p className="text-[10px] text-muted-foreground">Queue Depth</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-lg font-bold text-destructive">{MOCK_TIMEOUT_STATS.hungConnectionCount}</p><p className="text-[10px] text-muted-foreground">Hung Connections</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-lg font-bold text-foreground">{MOCK_TIMEOUT_STATS.p95LatencyMs}ms</p><p className="text-[10px] text-muted-foreground">p95 Latency</p></div></Card>
            </div>
          </div>
        );
      case "promptInjection":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Untrusted input in the context window can become instructions. These are detected injection patterns.</p>
            <InjectionFlagBadge count={MOCK_INJECTION.totalAttempts} blockedCount={MOCK_INJECTION.blockedCount} total={MOCK_INJECTION.totalAttempts * 100} />
            <div className="grid grid-cols-2 gap-3">
              <Card><CardHeader title="Top Patterns" subtitle="Most common injection attempts" /><div className="px-3 pb-3 space-y-1.5">{MOCK_INJECTION.topPatterns.map(p => <div key={p.pattern} className="flex items-center justify-between text-xs"><span className="text-foreground">{p.pattern}</span><Badge>{p.count}</Badge></div>)}</div></Card>
              <Card><CardHeader title="By Model" subtitle="Injection targets" /><div className="px-3 pb-3 space-y-1.5">{MOCK_INJECTION.byModel.map(m => <div key={m.model} className="flex items-center justify-between text-xs"><span className="text-foreground">{m.model}</span><Badge>{m.count}</Badge></div>)}</div></Card>
            </div>
          </div>
        );
      case "testDeterminism":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Eval harness results across prompt versions. Assert on shape and properties, not exact strings.</p>
            <div className="flex items-center gap-3">
              <EvalRunStatus status={MOCK_EVAL.currentPassRate >= 80 ? "passed" : "failed"} passRate={MOCK_EVAL.currentPassRate} total={MOCK_EVAL.totalRuns} />
              <Badge variant="destructive">{MOCK_EVAL.regressionCount} regressions</Badge>
            </div>
            {MOCK_EVAL.recentRegressions.map(r => <EvalRegressionBadge key={r._id} {...r} />)}
          </div>
        );
      case "costControl":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Unbounded chat history = unbounded bill. Budget caps and token limits prevent cost from outrunning revenue.</p>
            <BudgetProgressBar budget={MOCK_BUDGET.budget} spent={MOCK_BUDGET.spent} projected={MOCK_BUDGET.projected} />
          </div>
        );
      case "contextWindow":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Past the window limit, content gets truncated and instructions buried in the middle get lost.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{MOCK_CONTEXT.avgPercentage.toFixed(0)}%</p><p className="text-[10px] text-muted-foreground">Avg Usage</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-warning">{MOCK_CONTEXT.over80PctCount.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">&gt;80% Usage</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{MOCK_CONTEXT.over95PctCount.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">&gt;95% Usage</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{MOCK_CONTEXT.truncationCount}</p><p className="text-[10px] text-muted-foreground">Truncated</p></div></Card>
            </div>
            {MOCK_CONTEXT.byModel.map(m => <ContextWindowBar key={m.model} label={m.model} tokensUsed={m.avgPercentage * 100} tokenLimit={10000} compact />)}
          </div>
        );
      case "evalHarness":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Without an eval harness, every prompt change is a coin flip. Track pass/fail rates across versions.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{MOCK_EVAL.totalRuns}</p><p className="text-[10px] text-muted-foreground">Total Runs</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold" style={{color: MOCK_EVAL.currentPassRate >= 80 ? "var(--color-success)" : "var(--color-destructive)"}}>{MOCK_EVAL.currentPassRate}%</p><p className="text-[10px] text-muted-foreground">Pass Rate</p></div></Card>
              <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{MOCK_EVAL.regressionCount}</p><p className="text-[10px] text-muted-foreground">Regressions</p></div></Card>
            </div>
          </div>
        );
      case "outputTrust":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Parse then validate then sanity-check. The model is allowed to be wrong — your code isn't allowed to assume it's right.</p>
            <SchemaValidationBadge validRate={MOCK_SCHEMA.validRate} total={MOCK_SCHEMA.total} invalidCount={MOCK_SCHEMA.invalidCount} topErrors={MOCK_SCHEMA.topErrors} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Reliability Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Seven dimensions of LLM application reliability — monitor, alert, and fix before users notice
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">Updated 2m ago</Badge>
          <RefreshCw className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Overall Reliability Score */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-muted/30 border border-border">
          <ReliabilityGauge score={scoreResult.overall} size="lg" label="Overall Reliability Score" />
          <p className="text-xs text-muted-foreground max-w-md text-center">
            Aggregated across timeouts, injection, evals, cost, context, and output trust
          </p>
        </div>
      </div>

      {/* 7 Dimension Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {DIMENSIONS.map((dim) => {
          const score = scoreResult.dimensions[dim.key];
          const Icon = dim.icon;
          return (
            <button
              key={dim.key}
              onClick={() => setSelectedDim(selectedDim === dim.key ? null : dim.key)}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                selectedDim === dim.key
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${dim.color} bg-opacity-20`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  {(scoreResult.breakdown[dim.key]?.previousScore !== undefined) && (
                    scoreResult.breakdown[dim.key].previousScore < score
                      ? <ArrowUp className="w-3.5 h-3.5 text-success" />
                      : <ArrowDown className="w-3.5 h-3.5 text-destructive" />
                  )}
                  <span className={`text-lg font-bold font-mono ${
                    score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive"
                  }`}>
                    {score}
                  </span>
                </div>
              </div>
              <h3 className="font-heading font-semibold text-sm text-foreground">{dim.label}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">{dim.description}</p>
            </button>
          );
        })}
      </div>

      {/* Selected Dimension Detail */}
      {selectedDim && (
        <Card>
          <CardHeader
            title={DIMENSIONS.find(d => d.key === selectedDim)?.label ?? "Details"}
            subtitle="Detailed metrics and recommendations"
          />
          <div className="px-4 pb-4">
            {dimensionDetails(selectedDim)}
          </div>
        </Card>
      )}

      {/* Fix Suggestions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-warning" />
            <h2 className="font-heading text-lg font-bold text-foreground">Fix Suggestions</h2>
            <Badge variant="neutral">{suggestions.length} items</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(!showSuggestions)}>
            {showSuggestions ? "Hide" : "Show"}
          </Button>
        </div>
        {showSuggestions && (
          <div className="space-y-2">
            {suggestions.length === 0 ? (
              <Card>
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">All dimensions are healthy!</p>
                  <p className="text-xs text-muted-foreground mt-1">No fix suggestions right now.</p>
                </div>
              </Card>
            ) : (
              suggestions.map((s, i) => (
                <Card key={s.id ?? i}>
                  <div className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 ${
                      s.severity === "critical" ? "text-destructive" :
                      s.severity === "warning" ? "text-warning" : "text-muted-foreground"
                    }`}>
                      {s.severity === "critical" ? <XCircle className="w-4 h-4" /> :
                       s.severity === "warning" ? <AlertTriangle className="w-4 h-4" /> :
                       <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                        <Badge variant={s.severity === "critical" ? "destructive" : s.severity === "warning" ? "warning" : "neutral"}>
                          {s.severity}
                        </Badge>
                        <Badge variant="neutral">{s.effort}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                      {s.action && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{s.action}</p>
                      )}
                    </div>
                    <Badge variant={s.impact >= 80 ? "success" : s.impact >= 50 ? "neutral" : "neutral"}>
                      +{s.impact}%
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}