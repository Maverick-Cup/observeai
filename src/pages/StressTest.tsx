import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { useSyntheticData } from "../hooks/useSyntheticData";
import { PerformanceProfiler, usePerformanceMonitor } from "../hooks/usePerformanceMonitor";
import { useConvexLoadTester } from "../hooks/useConvexLoadTester";
import { useE2ETestRunner } from "../hooks/useE2ETestRunner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { chartTooltip, CHART_COLORS } from "../utils/chart";
import {
  Database,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Play,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Gauge,
  BarChart3,
  List,
  Clock,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { DashboardStats } from "../types";

type TabId = "generator" | "perf" | "load" | "e2e";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "generator", label: "Data Generator", icon: <Database className="w-4 h-4" /> },
  { id: "perf", label: "Performance", icon: <Activity className="w-4 h-4" /> },
  { id: "load", label: "Convex Load Test", icon: <Zap className="w-4 h-4" /> },
  { id: "e2e", label: "E2E Flow Tests", icon: <FlaskConical className="w-4 h-4" /> },
];

const MODEL_OPTIONS = [
  { name: "GPT-4o", provider: "OpenAI", weight: 0.35 },
  { name: "Claude 3.5 Sonnet", provider: "Anthropic", weight: 0.25 },
  { name: "GPT-3.5 Turbo", provider: "OpenAI", weight: 0.15 },
  { name: "Llama 3 70B", provider: "Meta", weight: 0.10 },
  { name: "Gemini 1.5 Pro", provider: "Google", weight: 0.08 },
  { name: "Mistral Large", provider: "Mistral", weight: 0.07 },
];

/** Tab button component */
function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out cursor-pointer
        ${
          active
            ? "bg-primary/15 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ──────────────── TAB 1: SYNTHETIC DATA GENERATOR ────────────────

function DataGeneratorTab() {
  const { generate, clearData, loadData, computeStats, generating, progress } = useSyntheticData();
  const [count, setCount] = useState(500);
  const [errorRate, setErrorRate] = useState(0.03);
  const [daysBack, setDaysBack] = useState(30);
  const [minCost, setMinCost] = useState(0.001);
  const [maxCost, setMaxCost] = useState(0.05);
  const [includeEvals, setIncludeEvals] = useState(true);
  const [includeSpans, setIncludeSpans] = useState(true);
  const [traces, setTraces] = useState(loadData());
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    const existing = loadData();
    return existing.length > 0 ? computeStats(existing) : null;
  });

  const [showChart, setShowChart] = useState(false);

  const handleGenerate = async () => {
    const modelMix = MODEL_OPTIONS.map((m) => ({ ...m }));
    const newTraces = await generate({ count, modelMix, errorRate, daysBack, minCost, maxCost, includeEvaluations: includeEvals, includeSpans });
    setTraces(newTraces);
    setStats(computeStats(newTraces));
    setShowChart(true);
  };

  const handleClear = () => {
    clearData();
    setTraces([]);
    setStats(null);
    setShowChart(false);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader title="Generation Parameters" subtitle="Configure the synthetic dataset" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Trace count */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Trace Count: <span className="text-foreground font-bold">{count.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={10}
              max={10000}
              step={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>10</span>
              <span>1000</span>
              <span>5000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Error rate */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Error Rate: <span className="text-foreground font-bold">{(errorRate * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={errorRate}
              onChange={(e) => setErrorRate(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Days back */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date Range: <span className="text-foreground font-bold">{daysBack} days</span>
            </label>
            <input
              type="range"
              min={1}
              max={90}
              step={1}
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1d</span>
              <span>30d</span>
              <span>60d</span>
              <span>90d</span>
            </div>
          </div>

          {/* Cost range */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Cost per Trace: <span className="text-foreground font-bold">${minCost.toFixed(3)}–${maxCost.toFixed(3)}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.0001}
                max={0.1}
                step={0.0001}
                value={minCost}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v <= maxCost) setMinCost(v);
                }}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">min</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={0.001}
                max={0.5}
                step={0.001}
                value={maxCost}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= minCost) setMaxCost(v);
                }}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">max</span>
            </div>
          </div>
        </div>

        {/* Options & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEvals}
                onChange={(e) => setIncludeEvals(e.target.checked)}
                className="rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">Evaluations</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSpans}
                onChange={(e) => setIncludeSpans(e.target.checked)}
                className="rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">Spans</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClear} disabled={traces.length === 0}>
              <Trash2 className="w-4 h-4" />
              Clear Data
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating... {progress}%</>
              ) : (
                <><Play className="w-4 h-4" /> Generate</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress bar */}
      {generating && (
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader title="Total Traces" />
            <p className="text-2xl font-bold font-heading text-foreground px-4 pb-4">
              {stats.totalTraces.toLocaleString()}
            </p>
          </Card>
          <Card>
            <CardHeader title="Total Cost" />
            <p className="text-2xl font-bold font-heading text-foreground px-4 pb-4">
              ${stats.totalCost.toFixed(2)}
            </p>
          </Card>
          <Card>
            <CardHeader title="Avg Latency" />
            <p className="text-2xl font-bold font-heading text-foreground px-4 pb-4">
              {stats.avgLatency.toFixed(0)}ms
            </p>
          </Card>
          <Card>
            <CardHeader title="Total Tokens" />
            <p className="text-2xl font-bold font-heading text-foreground px-4 pb-4">
              {stats.totalTokens.toLocaleString()}
            </p>
          </Card>
        </div>
      )}

      {/* Chart preview */}
      {stats && showChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trace volume over time */}
          <Card>
            <CardHeader title="Trace Volume" subtitle="Generated data over time" />
            <div className="h-56 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={chartTooltip()} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Model distribution */}
          <Card>
            <CardHeader title="Model Distribution" subtitle="By trace count" />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.modelDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {stats.modelDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltip()} />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "var(--color-muted-foreground)", fontSize: "11px" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ──────────────── TAB 2: PERFORMANCE MONITOR ────────────────

function PerformanceTab() {
  const { subscribe, getStats, clearEntries, PerformanceProfiler: Profiler } = usePerformanceMonitor();
  const [stats, setStats] = useState<Map<string, ReturnType<typeof getStats> extends Map<infer K, infer V> ? [K, V][] : never>>(new Map());
  const [active, setActive] = useState(false);

  const startMonitoring = useCallback(() => {
    subscribe();
    setActive(true);
  }, [subscribe]);

  const refresh = useCallback(() => {
    const s = getStats();
    setStats(new Map(s));
  }, [getStats]);

  // Auto-refresh every 2s when active
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [active, refresh]);

  const handleClear = () => {
    clearEntries();
    setStats(new Map());
  };

  const statEntries = Array.from(stats.entries());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="React Profiler"
          subtitle="Track component render timings with Profiler wrappers"
        />
        <div className="flex items-center gap-2 pt-2 px-4 pb-4">
          {!active ? (
            <Button size="sm" onClick={startMonitoring}>
              <Play className="w-4 h-4" />
              Start Monitoring
            </Button>
          ) : (
            <>
              <Badge variant="success">Monitoring active</Badge>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </>
          )}
        </div>
      </Card>

      {active && statEntries.length === 0 && (
        <Card>
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No profiler data yet. Interact with the app (navigate pages, click things) and then refresh.</p>
          </div>
        </Card>
      )}

      {statEntries.length > 0 && (
        <Card>
          <CardHeader title="Component Render Stats" subtitle="Aggregated profiler data" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Component</th>
                  <th className="text-right py-2 px-3 font-medium">Renders</th>
                  <th className="text-right py-2 px-3 font-medium">Total (ms)</th>
                  <th className="text-right py-2 px-3 font-medium">Avg (ms)</th>
                  <th className="text-right py-2 px-3 font-medium">Max (ms)</th>
                  <th className="text-right py-2 px-3 font-medium">Mount (ms)</th>
                </tr>
              </thead>
              <tbody>
                {statEntries.map(([id, s]) => (
                  <tr key={id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-xs text-foreground">{id}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.renderCount}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.totalDuration.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.avgDuration.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.maxDuration.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{s.mountDuration.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Usage guide */}
      <Card>
        <CardHeader title="How to Use" subtitle="Wrapping components with the Profiler" />
        <div className="p-4 space-y-2 text-sm text-muted-foreground">
          <p>1. Click <strong>Start Monitoring</strong> above</p>
          <p>2. Navigate between pages, open modals, hover charts</p>
          <p>3. Click <strong>Refresh</strong> to see updated stats</p>
          <p className="mt-2 text-[11px] bg-muted p-2 rounded border border-border font-mono">
            {"<PerformanceProfiler id=\"Dashboard\">\n  <Dashboard />\n</PerformanceProfiler>"}
          </p>
          <p className="text-[11px] mt-1">The Profiler can wrap any component — add it to pages, charts, or tables you want to measure.</p>
        </div>
      </Card>
    </div>
  );
}

// ──────────────── TAB 3: CONVEX LOAD TESTER ────────────────

function ConvexLoadTab() {
  const { runBatch, abort, clearResults, running, progress, results, configured } = useConvexLoadTester();
  const [batchSize, setBatchSize] = useState(50);
  const [concurrency, setConcurrency] = useState(5);
  const [queryPath, setQueryPath] = useState("traces:list");
  const [requestType, setRequestType] = useState<"query" | "mutation">("query");

  if (!configured) {
    return (
      <Card>
        <div className="p-10 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <h3 className="font-heading text-lg font-semibold text-foreground mb-2">Convex Not Configured</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Set <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">VITE_CONVEX_URL</code> in your{" "}
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file to enable load testing
            against your Convex backend.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Load Test Config" subtitle="Fire batches of concurrent Convex requests" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 pb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Batch Size</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Concurrency</label>
            <input
              type="number"
              min={1}
              max={50}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Request Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as "query" | "mutation")}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="query">Query</option>
              <option value="mutation">Mutation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Query/Mutation Path</label>
            <input
              type="text"
              value={queryPath}
              onChange={(e) => setQueryPath(e.target.value)}
              placeholder="e.g. traces:list"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Progress */}
        {running && progress && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{progress.completed} / {progress.total} completed</span>
              <span>{progress.errors} errors · {(progress.elapsed / 1000).toFixed(1)}s</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-border">
          <Button
            size="sm"
            onClick={() => runBatch(queryPath, requestType, queryPath, () => ({}), batchSize, concurrency)}
            disabled={running}
          >
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Play className="w-4 h-4" /> Run Load Test</>}
          </Button>
          {running && (
            <Button variant="destructive" size="sm" onClick={abort}>
              <XCircle className="w-4 h-4" /> Abort
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={clearResults} disabled={results.length === 0}>
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        </div>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader title="Test Results" subtitle="Most recent runs" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Label</th>
                  <th className="text-right py-2 px-3 font-medium">Batch</th>
                  <th className="text-right py-2 px-3 font-medium">Concurrency</th>
                  <th className="text-right py-2 px-3 font-medium">Duration</th>
                  <th className="text-right py-2 px-3 font-medium">Req/s</th>
                  <th className="text-right py-2 px-3 font-medium">Avg Latency</th>
                  <th className="text-right py-2 px-3 font-medium">P50</th>
                  <th className="text-right py-2 px-3 font-medium">P95</th>
                  <th className="text-right py-2 px-3 font-medium">P99</th>
                  <th className="text-right py-2 px-3 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-xs text-foreground">{r.label}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.batchSize}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.concurrency}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{(r.durationMs / 1000).toFixed(1)}s</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      {(r.completed / (r.durationMs / 1000)).toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.avgLatency.toFixed(0)}ms</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.p50.toFixed(0)}ms</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.p95.toFixed(0)}ms</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.p99.toFixed(0)}ms</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-mono text-xs ${r.errors > 0 ? "text-destructive" : "text-success"}`}>
                        {r.errors}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ──────────────── TAB 4: E2E FLOW TESTS ────────────────

function E2ETestTab() {
  const navigate = useNavigate();
  const { runSuite, clearResults, running, results } = useE2ETestRunner();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="E2E Flow Tests" subtitle="Scripted user journey verification" />
        <div className="flex items-center gap-2 px-4 pb-4">
          <Button size="sm" onClick={() => runSuite(navigate)} disabled={running}>
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running Suite...</>
            ) : (
              <><Play className="w-4 h-4" /> Run All Tests</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={clearResults} disabled={results.length === 0}>
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        </div>
      </Card>

      {results.length === 0 && !running && (
        <Card>
          <div className="p-8 text-center">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Click <strong>Run All Tests</strong> to verify core user flows. Tests will navigate through pages and check for expected content.
            </p>
          </div>
        </Card>
      )}

      {running && (
        <Card>
          <div className="p-6 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Running test suite...</p>
          </div>
        </Card>
      )}

      {results.map((suite, si) => (
        <Card key={si}>
          <CardHeader
            title={suite.suiteName}
            subtitle={`${suite.passed}/${suite.total} passed · ${(suite.durationMs / 1000).toFixed(1)}s`}
            action={
              <div className="flex items-center gap-2">
                <Badge variant={suite.failed === 0 ? "success" : "destructive"}>
                  {suite.failed === 0 ? "All Passed" : `${suite.failed} Failed`}
                </Badge>
              </div>
            }
          />
          <div className="divide-y divide-border/50">
            {suite.steps.map((step) => (
              <div key={step.stepId} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5">
                  {step.pass ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{step.label}</span>
                    <Badge variant={step.pass ? "success" : "destructive"} size="sm">
                      {step.pass ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                  {step.durationMs.toFixed(0)}ms
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ──────────────── MAIN PAGE ────────────────

export default function StressTest() {
  const [activeTab, setActiveTab] = useState<TabId>("generator");

  return (
    <AppShell projectName="Stress Lab">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Stress Lab</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Synthetic data generation, performance profiling, load testing, and E2E flow verification
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 flex-wrap border-b border-border pb-1">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              icon={tab.icon}
              label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Tab content */}
        <PerformanceProfiler id="StressLab">
          {activeTab === "generator" && <DataGeneratorTab />}
          {activeTab === "perf" && <PerformanceTab />}
          {activeTab === "load" && <ConvexLoadTab />}
          {activeTab === "e2e" && <E2ETestTab />}
        </PerformanceProfiler>
      </div>
    </AppShell>
  );
}