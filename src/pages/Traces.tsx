import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge, StatusDot } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable } from "../components/ui/DataTable";
import { Search, Braces } from "lucide-react";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import { CONFIG } from "../constants/config";
import type { Trace } from "../types";

const MOCK_TRACES: Trace[] = Array.from({ length: 25 }).map((_, i) => ({
  _id: `trace_${i}`,
  _creationTime: Date.now() - i * 3600000,
  traceId: `trace_abc${i}${String.fromCharCode(97 + (i % 26))}${i}`,
  userQuery: ["What is the capital of France?", "How do I reset my password?", "Explain quantum computing in simple terms", "Show me my recent orders", "What's the weather in Tokyo?", "Can you help me write a poem?"][i % 6],
  response: "Mock response...",
  model: ["GPT-4o", "Claude 3.5", "Llama 3", "GPT-3.5"][i % 4],
  modelProvider: ["OpenAI", "Anthropic", "Meta", "OpenAI"][i % 4],
  latencyMs: Math.floor(Math.random() * 3000) + 200,
  tokenCount: Math.floor(Math.random() * 2000) + 100,
  costUsd: Math.random() * 0.05,
  status: (["success", "success", "success", "error", "partial"] as const)[i % 5],
  environment: ["production", "staging", "development"][i % 3],
  createdAt: Date.now() - i * 3600000,
  updatedAt: Date.now() - i * 3600000,
  projectId: "",
  organizationId: "",
  evaluation: i % 5 === 0 ? { _id: `e${i}`, _creationTime: Date.now(), traceId: `trace_${i}`, scorerType: "heuristic", overallScore: Math.random() * 0.4, createdAt: Date.now() } : { _id: `e${i}`, _creationTime: Date.now(), traceId: `trace_${i}`, scorerType: "heuristic", overallScore: 0.85 + Math.random() * 0.15, createdAt: Date.now() },
  feedback: i % 7 === 0 ? { _id: `f${i}`, _creationTime: Date.now(), traceId: `trace_${i}`, projectId: "", rating: 2, createdAt: Date.now() } : null,
}));

export default function Traces() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof Trace>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const configured = isConvexConfigured();
  const { data: realTraces } = useConvexQuery<Trace[]>(
    configured ? "traces:list" : null,
    { projectId: CONFIG.projectId },
  );
  const traces = realTraces ?? MOCK_TRACES;

  const filtered = traces
    .filter((t) =>
      t.userQuery?.toLowerCase().includes(search.toLowerCase()) ||
      t.traceId?.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "desc"
        ? (bVal > aVal ? 1 : -1)
        : (aVal > bVal ? 1 : -1);
    });

  const columns = [
    {
      key: "traceId",
      label: "Trace ID",
      render: (v: string) => (
        <span className="font-mono text-xs text-primary">{v.slice(0, 12)}...</span>
      ),
    },
    {
      key: "userQuery",
      label: "Query",
      render: (v: string) => (
        <span className="max-w-[220px] truncate block text-sm">{v}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v: string) => (
        <div className="flex items-center gap-1.5">
          <StatusDot status={v} />
          <span className="text-xs capitalize">{v}</span>
        </div>
      ),
    },
    {
      key: "model",
      label: "Model",
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      key: "latencyMs",
      label: "Latency",
      render: (v: number) => (
        <span className="font-mono text-xs">{v}ms</span>
      ),
    },
    {
      key: "costUsd",
      label: "Cost",
      render: (v: number) => (
        <span className="font-mono text-xs">${v?.toFixed(4)}</span>
      ),
    },
    {
      key: "environment",
      label: "Env",
      render: (v: string) => (
        <Badge variant={v === "production" ? "info" : v === "staging" ? "warning" : "neutral"}>
          {v}
        </Badge>
      ),
    },
    {
      key: "evaluation",
      label: "Score",
      render: (v: Trace["evaluation"]) => {
        const score = v?.overallScore ?? 1;
        return (
          <span className={`font-heading text-xs font-semibold ${
            score < 0.5 ? "text-destructive" : score < 0.7 ? "text-warning" : "text-success"
          }`}>
            {(score * 100).toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Time",
      render: (v: number) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Traces</h1>
          <p className="text-sm text-muted-foreground mt-1">Search and inspect every LLM interaction</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Braces className="w-3.5 h-3.5" />
          <span>{traces.length} traces</span>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by query or trace ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all"
        />
      </div>

      <Card>
        <CardHeader title="All Traces" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Braces className="w-12 h-12" />}
            title="No traces found"
            description="Ingest your first trace using the ObserveAI SDK to see data here."
            action={<Button variant="primary">View SDK docs</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => navigate(`/traces/${row._id}`)}
          />
        )}
      </Card>
    </AppShell>
  );
}