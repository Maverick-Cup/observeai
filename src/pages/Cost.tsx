import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DataTable } from "../components/ui/DataTable";
import { Skeleton } from "../components/ui/Skeleton";
import { Download, DollarSign, Wallet } from "lucide-react";
import { BudgetProgressBar } from "../components/ui/BudgetProgressBar";
import { CHART_COLORS, chartTooltip } from "../utils/chart";
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
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import { CONFIG } from "../constants/config";

const MOCK_DAILY_COST = [
  { date: "Jun 30", cost: 41.2, tokens: 2100000 },
  { date: "Jul 01", cost: 38.9, tokens: 1950000 },
  { date: "Jul 02", cost: 42.3, tokens: 2180000 },
  { date: "Jul 03", cost: 36.7, tokens: 1840000 },
  { date: "Jul 04", cost: 29.8, tokens: 1520000 },
  { date: "Jul 05", cost: 35.1, tokens: 1760000 },
  { date: "Jul 06", cost: 60.56, tokens: 2450000 },
];

const MOCK_COST_BY_MODEL = [
  { name: "GPT-4o", cost: 182.4, percentage: 64 },
  { name: "Claude 3.5", cost: 68.2, percentage: 24 },
  { name: "GPT-3.5", cost: 25.6, percentage: 9 },
  { name: "Llama 3", cost: 8.4, percentage: 3 },
];

const MOCK_EXPENSIVE_TRACES = [
  { _id: "exp1", traceId: "trace_xyz_001", userQuery: "Generate comprehensive annual report with charts and analysis", model: "GPT-4o", latencyMs: 15230, tokenCount: 24567, costUsd: 0.4567, createdAt: Date.now() - 7200000 },
  { _id: "exp2", traceId: "trace_xyz_002", userQuery: "Analyze this 500-page legal document and summarize key clauses", model: "Claude 3.5", latencyMs: 28450, tokenCount: 52300, costUsd: 0.8234, createdAt: Date.now() - 14400000 },
  { _id: "exp3", traceId: "trace_xyz_003", userQuery: "Write a 5000-word blog post about quantum computing advancements", model: "GPT-4o", latencyMs: 18900, tokenCount: 18900, costUsd: 0.3456, createdAt: Date.now() - 21600000 },
];

export default function Cost() {
  const [period, _setPeriod] = useState("7d");
  const configured = isConvexConfigured();

  const { data: realStats } = useConvexQuery<{
    totalCost: number;
    dailyCost: Array<{ date: string; cost: number; tokens: number }>;
    costByModel: Array<{ name: string; cost: number; percentage: number }>;
  }>(configured ? "traces:stats" : null, { projectId: CONFIG.projectId });

  const { data: realExpensive } = useConvexQuery<Array<{
    _id: string; traceId: string; userQuery: string; model: string;
    latencyMs: number; tokenCount: number; costUsd: number; createdAt: number;
  }>>(configured ? "traces:topExpensive" : null, {});

  const dailyCost = realStats?.dailyCost ?? MOCK_DAILY_COST;
  const costByModel = realStats?.costByModel ?? MOCK_COST_BY_MODEL;
  const expensiveTraces = realExpensive ?? MOCK_EXPENSIVE_TRACES;
  const totalCost = realStats?.totalCost ?? MOCK_DAILY_COST.reduce((s, d) => s + d.cost, 0);
  const totalTokens = MOCK_DAILY_COST.reduce((s, d) => s + d.tokens, 0);

  const expensiveColumns = [
    { key: "traceId", label: "Trace ID", render: (v: string) => <span className="font-mono text-xs text-primary">{v.slice(0, 14)}...</span> },
    { key: "userQuery", label: "Query", render: (v: string) => <span className="max-w-[200px] truncate block">{v}</span> },
    { key: "model", label: "Model", render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span> },
    { key: "tokenCount", label: "Tokens", render: (v: number) => <span className="font-mono text-xs">{v.toLocaleString()}</span> },
    { key: "costUsd", label: "Cost", render: (v: number) => <span className="font-mono text-xs font-semibold text-destructive">${v.toFixed(4)}</span> },
    { key: "latencyMs", label: "Latency", render: (v: number) => <span className="font-mono text-xs">{v}ms</span> },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Cost Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track LLM spending across models and time periods</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{period}</Badge>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Cost (7d)" value={`$${totalCost.toFixed(2)}`} subValue="All models" icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="Avg Daily" value={`$${(totalCost / 7).toFixed(2)}`} subValue="Per day" icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="Total Tokens" value={(totalTokens / 1000000).toFixed(1) + "M"} subValue="Processed" icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="Avg Cost/Trace" value={`$${(totalCost / 4000).toFixed(4)}`} subValue="Per trace" icon={<DollarSign className="w-4 h-4" />} />
      </div>

      {/* Budget Progress */}
      <div className="mb-6">
        <Card>
          <CardHeader
            title="Monthly Budget"
            subtitle="Track spending against your monthly budget cap"
            icon={<Wallet className="w-4 h-4 text-primary" />}
          />
          <BudgetProgressBar
            budget={500}
            spent={totalCost > 0 ? totalCost : 284.56}
            projected={415.3}
            showLabels
            compact={false}
          />
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader title="Daily Cost Breakdown" subtitle="LLM spend per day" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={chartTooltip()} />
                <Bar dataKey="cost" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cost by Model" subtitle="Distribution across LLMs" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costByModel}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="cost"
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                >
                  {costByModel.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltip()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Expensive Traces */}
      <Card>
        <CardHeader
          title="Most Expensive Traces"
          subtitle="Longest & costliest requests"
        />
        <DataTable columns={expensiveColumns} data={expensiveTraces} />
      </Card>
    </AppShell>
  );
}