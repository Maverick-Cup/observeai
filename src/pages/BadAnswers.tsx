import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge, StatusDot } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable } from "../components/ui/DataTable";
import { InjectionFlagBadge } from "../components/ui/InjectionFlagBadge";
import { SchemaValidationBadge } from "../components/ui/SchemaValidationBadge";
import { AlertTriangle, CheckCircle2, ExternalLink, Search, ThumbsDown, ShieldAlert, Code } from "lucide-react";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import { CONFIG } from "../constants/config";
import { MOCK_INJECTION, MOCK_SCHEMA } from "../data/reliability-data";
import type { Trace } from "../types";

const MOCK_BAD_ANSWERS: Trace[] = [
  {
    _id: "1",
    _creationTime: Date.now() - 3600000,
    traceId: "trace_abc123",
    userQuery: "What are the side effects of this medication?",
    response: "I'm not sure, you should ask your doctor about everything.",
    latencyMs: 2340,
    model: "GPT-4o",
    evaluation: { _id: "e1", _creationTime: Date.now(), traceId: "1", scorerType: "heuristic", overallScore: 0.32, faithfulness: 0.25, relevance: 0.40, safety: 0.95, createdAt: Date.now() },
    feedback: null,
    status: "success",
    environment: "production",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    projectId: "",
    organizationId: "",
  },
  {
    _id: "2",
    _creationTime: Date.now() - 7200000,
    traceId: "trace_def456",
    userQuery: "Can you write code to connect to the database?",
    response: "Here's the code to connect to PostgreSQL using psycopg2...",
    latencyMs: 4560,
    model: "Claude 3.5",
    evaluation: { _id: "e2", _creationTime: Date.now(), traceId: "2", scorerType: "heuristic", overallScore: 0.45, faithfulness: 0.30, relevance: 0.60, safety: 0.90, createdAt: Date.now() },
    feedback: { _id: "f1", _creationTime: Date.now(), traceId: "2", projectId: "", rating: 2, comment: "The connection string had wrong port", createdAt: Date.now() },
    status: "success",
    environment: "production",
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    projectId: "",
    organizationId: "",
  },
  {
    _id: "3",
    _creationTime: Date.now() - 14400000,
    traceId: "trace_ghi789",
    userQuery: "What's the weather like today?",
    response: "I cannot check live weather data, but based on historical patterns, it's probably sunny.",
    latencyMs: 1280,
    model: "GPT-3.5",
    evaluation: { _id: "e3", _creationTime: Date.now(), traceId: "3", scorerType: "heuristic", overallScore: 0.28, faithfulness: 0.15, relevance: 0.35, safety: 0.98, createdAt: Date.now() },
    feedback: { _id: "f2", _creationTime: Date.now(), traceId: "3", projectId: "", rating: 1, comment: "Wrong weather forecast", createdAt: Date.now() },
    status: "success",
    environment: "staging",
    createdAt: Date.now() - 14400000,
    updatedAt: Date.now() - 14400000,
    projectId: "",
    organizationId: "",
  },
];

export default function BadAnswers() {
  const [search, setSearch] = useState("");
  const configured = isConvexConfigured();
  const { data: realData, loading } = useConvexQuery<Trace[]>(
    configured ? "traces:listBadAnswers" : null,
    { projectId: CONFIG.projectId },
  );
  const data = realData ?? MOCK_BAD_ANSWERS;

  const filtered = data.filter(
    (d) =>
      d.userQuery?.toLowerCase().includes(search.toLowerCase()) ||
      d.traceId?.toLowerCase().includes(search.toLowerCase()),
  );

  const criticalCount = data.filter((d) => (d.evaluation?.overallScore ?? 1) < 0.4).length;
  const fixSuggestionCount = data.filter((d) => d.evaluation).length;
  const userReportedCount = data.filter((d) => d.feedback && d.feedback.rating <= 2).length;

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
      label: "User Query",
      render: (v: string) => (
        <span className="max-w-[200px] truncate block">{v}</span>
      ),
    },
    {
      key: "evaluation",
      label: "Score",
      render: (v: Trace["evaluation"]) => {
        const score = v?.overallScore ?? 1;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-heading text-sm font-semibold ${
              score < 0.4 ? "text-destructive" : score < 0.7 ? "text-warning" : "text-success"
            }`}>
              {(score * 100).toFixed(0)}%
            </span>
            <Badge variant={score < 0.4 ? "destructive" : "warning"}>
              {score < 0.4 ? "Critical" : "Poor"}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "model",
      label: "Model",
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      key: "feedback",
      label: "Feedback",
      render: (v: Trace["feedback"]) => {
        if (!v) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex items-center gap-1">
            <ThumbsDown className="w-3 h-3 text-destructive" />
            <span className="text-xs text-muted-foreground">{v.rating}/5</span>
          </div>
        );
      },
    },
    {
      key: "createdAt",
      label: "Age",
      render: (v: number) => (
        <span className="text-xs text-muted-foreground">
          {Math.floor((Date.now() - v) / 3600000)}h ago
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_: unknown, row: Trace) => (
        <Button variant="ghost" size="sm" onClick={() => window.location.href = `/traces/${row._id}`}>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Bad Answers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Traces flagged for low accuracy — fix suggestions and regression detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{filtered.length} flagged</Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical issues</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{fixSuggestionCount}</p>
              <p className="text-xs text-muted-foreground">Fix suggestions available</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
              <ThumbsDown className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{userReportedCount}</p>
              <p className="text-xs text-muted-foreground">User-reported issues</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Injection Detection Summary */}
      <Card>
        <CardHeader
          title="Injection Flag Detection"
          subtitle="Prompt injection attempts flagged across all traces"
          icon={<ShieldAlert className="w-4 h-4 text-purple-500" />}
        />
        <div className="px-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <InjectionFlagBadge
              count={MOCK_INJECTION.flaggedCount}
              blockedCount={MOCK_INJECTION.blockedCount}
              total={MOCK_INJECTION.totalAttempts}
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{MOCK_INJECTION.criticalCount} critical</span>
              <span className="w-px h-4 bg-border" />
              <span>Top pattern: "{MOCK_INJECTION.topPatterns[0].pattern}"</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Schema Validation Summary */}
      <div className="mt-4">
        <Card>
          <CardHeader
            title="Schema Validation Status"
            subtitle="JSON output parse & validation results"
            icon={<Code className="w-4 h-4 text-indigo-500" />}
          />
          <div className="px-4 pb-4">
            <SchemaValidationBadge
              validRate={MOCK_SCHEMA.validRate}
              total={MOCK_SCHEMA.total}
              invalidCount={MOCK_SCHEMA.invalidCount}
              topErrors={MOCK_SCHEMA.topErrors}
            />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mt-4 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search flagged traces..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all"
        />
      </div>

      {/* Bad Answers Table */}
      <Card>
        <CardHeader title="Flagged Traces" subtitle="Low accuracy detections" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-12 h-12" />}
            title="No bad answers found"
            description="All traces are performing well. If accuracy drops, flagged traces will appear here."
          />
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </Card>
    </AppShell>
  );
}