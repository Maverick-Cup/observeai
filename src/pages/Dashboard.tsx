import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ReliabilityGauge } from "../components/ui/ReliabilityGauge";
import { computeReliabilityScore } from "../engine/reliability-score";
import { generateFixSuggestions, type FixSuggestion } from "../engine/fix-suggestions";
import type { ScoreInputs, ReliabilityScoreResult } from "../engine/reliability-score";
import {
  MOCK_RELIABILITY,
  MOCK_TIMEOUT_STATS,
  MOCK_INJECTION,
  MOCK_EVAL,
  MOCK_BUDGET,
  MOCK_CONTEXT,
  MOCK_SCHEMA,
} from "../data/reliability-data";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code,
  DollarSign,
  FlaskConical,
  Maximize2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react";

// ── Build ScoreInputs from mock data ─────────────────────────────

function buildScoreInputs(): ScoreInputs {
  return {
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
  };
}

// ── Dimension metadata ───────────────────────────────────────────

const DIMENSION_META: Record<
  string,
  { label: string; icon: React.ElementType; route: string; description: string }
> = {
  timeoutsRetries: {
    label: "Timeouts & Retries",
    icon: Clock,
    route: "/traces",
    description: "Hard timeouts, retry caps, circuit breaker health",
  },
  promptInjection: {
    label: "Prompt Injection",
    icon: ShieldAlert,
    route: "/alerts",
    description: "Injection attempts, guardrail effectiveness",
  },
  testDeterminism: {
    label: "Test Determinism",
    icon: FlaskConical,
    route: "/evals",
    description: "Eval pass rates, regression detection",
  },
  costControl: {
    label: "Cost Control",
    icon: DollarSign,
    route: "/cost",
    description: "Budget utilization, spend trends",
  },
  contextWindow: {
    label: "Context Window",
    icon: Maximize2,
    route: "/context",
    description: "Truncation rates, window utilization",
  },
  evalHarness: {
    label: "Eval Harness",
    icon: Activity,
    route: "/evals",
    description: "Test coverage, regression alerts",
  },
  outputTrust: {
    label: "Output Trust",
    icon: Code,
    route: "/schema",
    description: "Schema compliance, output validation",
  },
};

// ── Severity config ───────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    dot: "bg-destructive",
    badge: "destructive" as const,
    border: "border-l-destructive",
    bg: "bg-destructive/[0.03]",
  },
  warning: {
    label: "Warning",
    dot: "bg-warning",
    badge: "warning" as const,
    border: "border-l-warning",
    bg: "bg-warning/[0.03]",
  },
  info: {
    label: "Info",
    dot: "bg-info",
    badge: "info" as const,
    border: "border-l-info",
    bg: "bg-info/[0.03]",
  },
};

// ── Feed Item Component ───────────────────────────────────────────

interface FeedItemProps {
  suggestion: FixSuggestion;
  index: number;
  onNavigate: (route: string) => void;
}

function FeedItem({ suggestion, index, onNavigate }: FeedItemProps) {
  const meta = DIMENSION_META[suggestion.dimension];
  const sev = SEVERITY_CONFIG[suggestion.severity];
  const Icon = meta?.icon ?? Shield;
  const route = meta?.route ?? "/";

  return (
    <div
      className={`relative flex items-start gap-4 p-5 bg-card border border-border rounded-xl
        shadow-md hover:shadow-lg transition-all duration-200 ease-out cursor-pointer
        border-l-4 ${sev.border} ${sev.bg}
        hover:border-primary/30 group
        animate-slide-up opacity-0 [animation-fill-mode:forwards]`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => onNavigate(route)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(route); }}
      aria-label={`${sev.label} issue: ${suggestion.title}`}
    >
      {/* Severity dot indicator */}
      <div className="hidden sm:flex flex-col items-center pt-1">
        <div className={`w-3 h-3 rounded-full ${sev.dot} ring-4 ring-${sev.dot}/20`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant={sev.badge}>{sev.label}</Badge>
          <span className="text-sm font-semibold text-foreground">{suggestion.title}</span>
          {meta && (
            <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          )}
          {meta && (
            <span className="text-xs text-muted-foreground hidden sm:inline">{meta.label}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{suggestion.action}</p>
      </div>

      {/* Arrow */}
      <div className="flex items-center pt-1">
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 ease-out" />
      </div>
    </div>
  );
}

// ── Healthy Dimension Card ────────────────────────────────────────

function HealthyDimCard({
  dimKey,
  score,
}: {
  dimKey: string;
  score: number;
}) {
  const meta = DIMENSION_META[dimKey];
  if (!meta) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/[0.04] border border-success/10">
      <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{score}/100 · No issues</p>
      </div>
    </div>
  );
}

// ── Mini Stat ─────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend?: { value: number; positive: boolean };
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-lg font-bold text-foreground">{value}</span>
          {trend && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
              {trend.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Problems Feed (Home Page) ────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { scoreResult, suggestions } = useMemo(() => {
    const inputs = buildScoreInputs();
    const result = computeReliabilityScore(inputs);
    const fixSugs = generateFixSuggestions({
      scores: result.dimensions,
      rawInputs: inputs,
    });
    return { scoreResult: result, suggestions: fixSugs };
  }, []);

  const issueCount = suggestions.length;
  const healthyCount = Object.values(scoreResult.dimensions).filter((s) => s >= 80).length;
  const criticalCount = suggestions.filter((s) => s.severity === "critical").length;

  // Determine which dimensions are healthy (score >= 80) and not in the fix list
  const issueDimensions = new Set(suggestions.map((s) => s.dimension));
  const healthyDimensions = Object.entries(scoreResult.dimensions)
    .filter(([key, score]) => score >= 80 && !issueDimensions.has(key))
    .map(([key]) => key);

  // Color for the overall score
  const scoreColor =
    scoreResult.overall >= 80
      ? "text-success"
      : scoreResult.overall >= 60
        ? "text-warning"
        : "text-destructive";

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, 5);

  return (
    <AppShell>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI reliability at a glance — issues, health metrics, and fix suggestions
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ── Hero: Score + Quick Stats ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8 mt-4">
        {/* Reliability Gauge — prominent hero position */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-md p-6 flex flex-col items-center justify-center">
          <ReliabilityGauge score={scoreResult.overall} size="lg" label="Overall Reliability" />
          <div className="mt-3 flex items-center gap-2">
            <span className={`font-heading text-sm font-bold ${scoreColor}`}>
              {scoreResult.overall >= 80 ? "Good" : scoreResult.overall >= 60 ? "Fair" : "Poor"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{scoreResult.overall}/100</span>
          </div>
        </div>

        {/* Quick Stats grid */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MiniStat
            label="Issues Needing Attention"
            value={issueCount.toString()}
            icon={AlertTriangle}
            trend={
              criticalCount > 0
                ? { value: criticalCount, positive: false }
                : undefined
            }
          />
          <MiniStat
            label="Healthy Dimensions"
            value={`${healthyCount}/7`}
            icon={ShieldCheck}
            trend={
              healthyCount >= 5
                ? { value: healthyCount * 14, positive: true }
                : undefined
            }
          />
          <MiniStat
            label="Cost Used"
            value={`$${MOCK_BUDGET.spent.toFixed(0)}`}
            icon={DollarSign}
            trend={
              MOCK_BUDGET.projected > MOCK_BUDGET.budget
                ? { value: ((MOCK_BUDGET.projected / MOCK_BUDGET.budget - 1) * 100), positive: false }
                : { value: 12, positive: true }
            }
          />
          <MiniStat
            label="Traces (7d)"
            value={(MOCK_TIMEOUT_STATS.totalCalls / 1000).toFixed(1) + "k"}
            icon={Activity}
            trend={{ value: 8.2, positive: true }}
          />
        </div>
      </div>

      {/* ── What Needs Attention ──────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">
              {issueCount > 0 ? "What Needs Attention" : "All Clear"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {issueCount > 0
                ? `${issueCount} issue${issueCount > 1 ? "s" : ""} detected across ${issueDimensions.size} dimension${issueDimensions.size > 1 ? "s" : ""}`
                : "No issues detected — your system is running smoothly"}
            </p>
          </div>
          {suggestions.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              {showAll ? "Show top 5" : `View all ${suggestions.length}`}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${showAll ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {/* Feed Items or Empty State */}
        {displayedSuggestions.length > 0 ? (
          <div className="space-y-3">
            {displayedSuggestions.map((s, i) => (
              <FeedItem
                key={`${s.dimension}-${i}`}
                suggestion={s}
                index={i}
                onNavigate={(route) => navigate(route)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<Sparkles className="w-12 h-12" />}
              title="Everything is healthy"
              description="All 7 reliability dimensions are scoring 80 or above. No issues to show right now — we'll notify you the moment something changes."
              action={
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/reliability")}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold
                      transition-all duration-150 ease-out cursor-pointer hover:brightness-110 active:scale-[0.97]"
                  >
                    View Reliability Center
                  </button>
                  <button
                    onClick={() => navigate("/traces")}
                    className="px-4 py-2 bg-transparent text-foreground border border-border rounded-lg text-sm font-medium
                      transition-all duration-150 ease-out cursor-pointer hover:bg-muted active:scale-[0.97]"
                  >
                    Browse Traces
                  </button>
                </div>
              }
            />
          </Card>
        )}
      </div>

      {/* ── Healthy Dimensions (collapsible summary) ────────────────── */}
      {healthyDimensions.length > 0 && displayedSuggestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Healthy Dimensions ({healthyDimensions.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {healthyDimensions.slice(0, showAll ? healthyDimensions.length : 4).map((dim) => (
              <HealthyDimCard key={dim} dimKey={dim} score={scoreResult.dimensions[dim as keyof typeof scoreResult.dimensions]} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}