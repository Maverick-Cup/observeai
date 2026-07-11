import { useState, useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ContextWindowBar, ModelContextBars } from "../components/ui/ContextWindowBar";
import { DataTable } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import SlideOver from "../components/ui/SlideOver";
import {
  Maximize2,
  AlertTriangle,
  Trash2,
  Sliders,
  TrendingUp,
  Target,
  Lightbulb,
  ExternalLink,
  ArrowRight,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { chartTooltip } from "../utils/chart";
import type { ContextUsage, ContextStats } from "../types/reliability";

// ── Mock data ─────────────────────────────────────────────────
const MOCK_CONTEXT_STATS: ContextStats = {
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
    { date: "Jun 10", avgPercentage: 62, truncations: 42 },
    { date: "Jun 14", avgPercentage: 65, truncations: 51 },
    { date: "Jun 18", avgPercentage: 68, truncations: 58 },
    { date: "Jun 22", avgPercentage: 61, truncations: 39 },
    { date: "Jun 26", avgPercentage: 67, truncations: 63 },
    { date: "Jun 30", avgPercentage: 64, truncations: 47 },
  ],
  recentOverflows: [
    { _id: "ctx1", _creationTime: Date.now(), traceId: "trace_ctx_001", model: "GPT-4o", tokenLimit: 128000, tokensUsed: 124500, percentage: 97.3, truncated: true, truncatedTokens: 3500, relevanceScore: 0.42, createdAt: Date.now() - 600000 },
    { _id: "ctx2", _creationTime: Date.now(), traceId: "trace_ctx_002", model: "Claude 3.5", tokenLimit: 100000, tokensUsed: 98200, percentage: 98.2, truncated: true, truncatedTokens: 1800, relevanceScore: 0.38, createdAt: Date.now() - 1800000 },
    { _id: "ctx3", _creationTime: Date.now(), traceId: "trace_ctx_003", model: "GPT-4o", tokenLimit: 128000, tokensUsed: 110500, percentage: 86.3, truncated: false, truncatedTokens: 0, relevanceScore: 0.65, createdAt: Date.now() - 3600000 },
    { _id: "ctx4", _creationTime: Date.now(), traceId: "trace_ctx_004", model: "Claude 3.5", tokenLimit: 100000, tokensUsed: 87500, percentage: 87.5, truncated: false, truncatedTokens: 0, relevanceScore: 0.71, createdAt: Date.now() - 7200000 },
    { _id: "ctx5", _creationTime: Date.now(), traceId: "trace_ctx_005", model: "GPT-3.5", tokenLimit: 16000, tokensUsed: 15800, percentage: 98.8, truncated: true, truncatedTokens: 200, relevanceScore: 0.55, createdAt: Date.now() - 14400000 },
  ],
};

const TRUNCATION_BY_DAY = [
  { date: "Jun 24", truncated: 47, over80: 212 },
  { date: "Jun 25", truncated: 51, over80: 198 },
  { date: "Jun 26", truncated: 39, over80: 234 },
  { date: "Jun 27", truncated: 58, over80: 267 },
  { date: "Jun 28", truncated: 43, over80: 189 },
  { date: "Jun 29", truncated: 37, over80: 221 },
  { date: "Jun 30", truncated: 47, over80: 203 },
];

const TOKEN_BUDGETS = [
  { model: "GPT-4o", limit: 128000, recommended: 102400, currentBudget: 96000 },
  { model: "Claude 3.5", limit: 100000, recommended: 80000, currentBudget: 75000 },
  { model: "GPT-3.5", limit: 16000, recommended: 12800, currentBudget: 12000 },
  { model: "Llama 3", limit: 8000, recommended: 6400, currentBudget: 6000 },
];

// ── Main component ────────────────────────────────────────────
export default function ContextMonitor() {
  const [showDetail, setShowDetail] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"forecast" | "recommendations" | "trace">("forecast");
  const [selectedTrace, setSelectedTrace] = useState<ContextUsage | null>(null);
  const stats = MOCK_CONTEXT_STATS;

  // ── Forecast projection using linear extrapolation ──
  const forecast = useMemo(() => {
    const data = stats.timeSeries;
    if (data.length < 2) return null;
    const n = data.length;
    const indices = data.map((_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, d) => a + d.avgPercentage, 0);
    const sumXY = indices.reduce((a, i) => a + i * data[i].avgPercentage, 0);
    const sumX2 = indices.reduce((a, i) => a + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const projected: { date: string; actual: number | null; projected: number | null }[] = [];
    // Add actuals
    data.forEach((d) => projected.push({ date: d.date, actual: d.avgPercentage, projected: null }));
    // Add 4 projected points
    for (let i = 1; i <= 4; i++) {
      const weekLabels = ["Jul 4", "Jul 8", "Jul 12", "Jul 16"];
      projected.push({
        date: weekLabels[i - 1],
        actual: null,
        projected: Math.round((slope * (n - 1 + i * 2) + intercept) * 10) / 10,
      });
    }
    return { slope, intercept, projected };
  }, [stats.timeSeries]);

  // Estimated day of hitting 95% (if trend continues)
  const hit95Estimate = useMemo(() => {
    if (!forecast || forecast.slope <= 0) return null;
    const currentPct = stats.avgPercentage;
    const daysTo95 = Math.round((95 - currentPct) / forecast.slope);
    if (daysTo95 > 365) return null;
    const est = new Date();
    est.setDate(est.getDate() + daysTo95 * 2);
    return { days: daysTo95 * 2, date: est.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  }, [forecast, stats.avgPercentage]);

  const openTraceDetail = (trace: ContextUsage) => {
    setSelectedTrace(trace);
    setPanelTab("trace");
    setPanelOpen(true);
  };

  const overflowColumns = [
    {
      key: "traceId",
      label: "Trace",
      render: (v: string, row: ContextUsage) => (
        <button onClick={() => openTraceDetail(row)} className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors text-left">
          {v.slice(0, 14)}...
        </button>
      ),
    },
    {
      key: "model",
      label: "Model",
      render: (v: string) => <Badge>{v}</Badge>,
    },
    {
      key: "percentage",
      label: "Usage",
      render: (v: number) => (
        <span className={`font-mono text-xs font-bold ${v >= 95 ? "text-destructive" : v >= 80 ? "text-warning" : "text-foreground"}`}>
          {v.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "truncated",
      label: "Truncated",
      render: (v: boolean) => v ? <Badge variant="destructive">Yes</Badge> : <Badge variant="success">No</Badge>,
    },
    {
      key: "truncatedTokens",
      label: "Lost Tokens",
      render: (v: number) => v > 0 ? <span className="font-mono text-xs text-destructive">{v.toLocaleString()}</span> : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "relevanceScore",
      label: "Relevance",
      render: (v: number | null) => v !== null ? (
        <span className={`font-mono text-xs ${v >= 0.7 ? "text-success" : v >= 0.4 ? "text-warning" : "text-destructive"}`}>
          {v.toFixed(2)}
        </span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "createdAt",
      label: "When",
      render: (v: number) => <span className="text-xs text-muted-foreground">{Math.floor((Date.now() - v) / 60000)}m ago</span>,
    },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Context Window Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Models lose what's buried in the middle of long prompts — track token usage, truncation, and relevance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={stats.over95PctCount > 500 ? "destructive" : stats.over80PctCount > 2000 ? "warning" : "success"}>
            {stats.over95PctCount} traces &gt;95% capacity
          </Badge>
          <button
            onClick={() => { setPanelTab("forecast"); setPanelOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent/50 border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Forecast &amp; Recommendations
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{stats.avgPercentage.toFixed(0)}%</p><p className="text-[10px] text-muted-foreground">Avg Usage</p></div></Card>
        <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-foreground">{stats.avgTokenUsage.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Avg Tokens</p></div></Card>
        <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-warning">{stats.over80PctCount.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">&gt;80% usage</p></div></Card>
        <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{stats.over95PctCount.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">&gt;95% usage</p></div></Card>
        <Card><div className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{stats.truncationCount}</p><p className="text-[10px] text-muted-foreground">Truncated</p></div></Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Usage trend */}
        <Card>
          <CardHeader title="Context Usage Trend" subtitle="Average % of window used over time" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeSeries}>
                <defs>
                  <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[40, 80]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltip()} />
                <Area type="monotone" dataKey="avgPercentage" stroke="var(--color-primary)" strokeWidth={2} fill="url(#usageGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Truncation events */}
        <Card>
          <CardHeader title="Truncation Events" subtitle="By day vs &gt;80% usage traces" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TRUNCATION_BY_DAY}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltip()} />
                <Bar dataKey="over80" fill="var(--color-warning)" radius={[4, 4, 0, 0]} opacity={0.6} name="&gt;80% usage" />
                <Bar dataKey="truncated" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Truncated" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* By Model & Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader title="Context Usage by Model" subtitle="Average percentage of window" />
          <div className="px-3 pb-4">
            {stats.byModel.map((m) => (
              <div key={m.model} className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{m.model}</span>
                  <span className="text-muted-foreground">{m.avgPercentage}% avg · {m.truncations} truncations</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      m.avgPercentage >= 80 ? "bg-destructive" : m.avgPercentage >= 65 ? "bg-warning" : "bg-primary"
                    }`}
                    style={{ width: `${m.avgPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Token Budgets" subtitle="Recommended vs current budget per model" icon={<Sliders className="w-4 h-4" />} />
          <div className="px-3 pb-4 space-y-3">
            {TOKEN_BUDGETS.map((b) => (
              <div key={b.model}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{b.model}</span>
                  <span className="text-muted-foreground">
                    {b.currentBudget.toLocaleString()} / {b.recommended.toLocaleString()} budget
                  </span>
                </div>
                <ContextWindowBar
                  tokensUsed={b.currentBudget}
                  tokenLimit={b.recommended}
                  compact
                />
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground mt-2">
              <Target className="w-3 h-3 inline mr-1" />
              Budget = max tokens you send, not max the model accepts. Lower = cheaper, faster.
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Overflows */}
      <Card>
        <CardHeader
          title="Recent High-Context Traces"
          subtitle="Traces using the most context window capacity"
        />
        {stats.recentOverflows.length === 0 ? (
          <EmptyState
            icon={<Maximize2 className="w-12 h-12" />}
            title="All context under control"
            description="No traces have exceeded 80% of their context window recently."
          />
        ) : (
          <DataTable columns={overflowColumns} data={stats.recentOverflows} />
        )}
      </Card>

      {/* ── Forecast & Insights Slide-Over Panel ── */}
      <SlideOver
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelTab === "forecast" ? "Context Forecast" : panelTab === "recommendations" ? "Optimization Recommendations" : "Trace Detail"}
        subtitle={panelTab === "forecast" ? "Projected usage trends based on recent data" : panelTab === "recommendations" ? "Ways to reduce token waste and cost" : selectedTrace?.traceId ?? ""}
      >
        {/* Tab selector inside panel */}
        <div className="flex items-center gap-1 mb-5 bg-muted p-1 rounded-lg w-fit">
          <button onClick={() => setPanelTab("forecast")} className={`px-3 py-1 text-xs rounded-md transition-all ${panelTab === "forecast" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <TrendingUp className="w-3 h-3 inline mr-1 -mt-0.5" />
            Forecast
          </button>
          <button onClick={() => setPanelTab("recommendations")} className={`px-3 py-1 text-xs rounded-md transition-all ${panelTab === "recommendations" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Lightbulb className="w-3 h-3 inline mr-1 -mt-0.5" />
            Recommendations
          </button>
        </div>

        {/* ── Forecast Tab ── */}
        {panelTab === "forecast" && (
          <div className="space-y-4">
            {/* Trend projection chart */}
            <Card>
              <CardHeader title="Projected Context Usage" subtitle="Actual vs projected trend (linear regression)" />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={forecast?.projected ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <YAxis domain={[40, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltip()} />
                    <Line type="monotone" dataKey="actual" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-primary)" }} name="Actual" connectNulls />
                    <Line type="monotone" dataKey="projected" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: "var(--color-warning)" }} name="Projected" connectNulls />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Hit-95 estimate */}
            {hit95Estimate && (
              <Card>
                <div className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Estimated 95% saturation</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      At the current trend, average context usage will hit 95% in <span className="text-destructive font-semibold">{hit95Estimate.days} days</span> ({hit95Estimate.date}).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Action suggested: review token budgets and implement context window management strategies before this point.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!hit95Estimate && forecast && forecast.slope <= 0 && (
              <Card>
                <div className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Usage trending flat or down</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Context usage is not projected to reach 95% any time soon. Keep monitoring for changes.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Per-model forecast */}
            <Card>
              <CardHeader title="Model Forecasts" subtitle="Days until 95% usage at current per-model rate" />
              <div className="space-y-3 px-3 pb-4">
                {stats.byModel.map((m) => {
                  const pctTo95 = 95 - m.avgPercentage;
                  const projectedDays = pctTo95 <= 0 ? 0 : Math.round(pctTo95 / 0.15); // rough 0.15% increase per day
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{m.model}</span>
                        <span className={projectedDays <= 30 ? "text-destructive font-semibold" : projectedDays <= 90 ? "text-warning" : "text-muted-foreground"}>
                          {projectedDays === 0 ? "Already at risk" : `~${projectedDays} days`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(100, (m.avgPercentage / 95) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── Recommendations Tab ── */}
        {panelTab === "recommendations" && (
          <div className="space-y-4">
            {/* GPT-4o */}
            <Card>
              <CardHeader title="GPT-4o" subtitle="128k window · 72% avg usage · $3.50/M input tokens" />
              <div className="px-3 pb-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Reduce budget from 96k → 80k tokens</span>
                  <Badge variant="success">Save ~17%</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Implement sliding window (last 32k tokens only)</span>
                  <Badge variant="success">Save ~$580/mo</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Add relevance-based eviction for RAG context</span>
                  <Badge variant="warning">Quality ↑</Badge>
                </div>
              </div>
            </Card>

            {/* Claude 3.5 */}
            <Card>
              <CardHeader title="Claude 3.5" subtitle="100k window · 68% avg usage · $2.80/M input tokens" />
              <div className="px-3 pb-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Drop budget 75k → 60k tokens</span>
                  <Badge variant="success">Save ~20%</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Pre-summarize conversation history before appending</span>
                  <Badge variant="success">Reduce truncation</Badge>
                </div>
              </div>
            </Card>

            {/* GPT-3.5 */}
            <Card>
              <CardHeader title="GPT-3.5" subtitle="16k window · 55% avg usage · $0.15/M input tokens" />
              <div className="px-3 pb-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Model is cheap — focus on truncation prevention over budget cuts</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">Set hard cap at 14k tokens with early truncation warning</span>
                  <Badge variant="warning">Quality ↑</Badge>
                </div>
              </div>
            </Card>

            {/* Cost impact summary */}
            <Card>
              <CardHeader title="Potential Monthly Savings" subtitle="If all recommendations are applied" />
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Current estimated cost</span>
                  <span className="text-sm font-semibold text-foreground">$5,240/mo</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Projected after optimization</span>
                  <span className="text-sm font-semibold text-success">$3,980/mo</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
                  <div className="h-full rounded-full bg-success" style={{ width: "76%" }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Savings of ~$1,260/mo (24%) without reducing output quality
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── Trace Detail Tab ── */}
        {panelTab === "trace" && selectedTrace && (
          <div className="space-y-4">
            <Card>
              <CardHeader title={selectedTrace.traceId} subtitle={`Triggered ${Math.floor((Date.now() - selectedTrace.createdAt) / 60000)} minutes ago`} />
              <div className="px-3 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Model</p>
                    <p className="text-sm font-medium text-foreground">{selectedTrace.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Token Limit</p>
                    <p className="text-sm font-medium text-foreground">{selectedTrace.tokenLimit.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Context Usage</p>
                  <ContextWindowBar tokensUsed={selectedTrace.tokensUsed} tokenLimit={selectedTrace.tokenLimit} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tokens Used</p>
                    <p className="text-sm font-medium text-foreground">{selectedTrace.tokensUsed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Truncated</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedTrace.truncated ? (
                        <span className="text-destructive">Yes — {selectedTrace.truncatedTokens.toLocaleString()} tokens lost</span>
                      ) : (
                        <span className="text-success">No</span>
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Relevance Score</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-bold ${selectedTrace.relevanceScore >= 0.7 ? "text-success" : selectedTrace.relevanceScore >= 0.4 ? "text-warning" : "text-destructive"}`}>
                      {selectedTrace.relevanceScore.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedTrace.relevanceScore >= 0.7 ? "Good" : selectedTrace.relevanceScore >= 0.4 ? "Fair" : "Poor"}
                    </span>
                  </div>
                </div>
                {selectedTrace.truncated && selectedTrace.truncatedTokens > 500 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-destructive">Significant truncation detected</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {selectedTrace.truncatedTokens.toLocaleString()} tokens were discarded. Consider increasing the budget or using a model with a larger context window.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Link to full trace detail */}
            <button
              onClick={() => window.open(`/trace/${selectedTrace.traceId}`, "_self")}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              View full trace detail
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SlideOver>
    </AppShell>
  );
}