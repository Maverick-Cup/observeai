import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge, StatusDot } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { DataTable } from "../components/ui/DataTable";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import { CONFIG } from "../constants/config";
import { RefreshCw, RotateCcw, Skull, Trash2 } from "lucide-react";

type DLQEntry = {
  _id: string;
  traceId: string;
  reason: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  status: "pending" | "processing" | "failed" | "succeeded";
  createdAt: number;
  projectId: string;
};

const MOCK_DLQ: DLQEntry[] = [
  { _id: "dlq1", traceId: "trace_dlq_001", reason: "timeout", payload: { model: "GPT-4o", query: "..." }, attempts: 3, maxAttempts: 5, lastError: "Gateway timeout after 30s", status: "pending", createdAt: Date.now() - 600000, projectId: "" },
  { _id: "dlq2", traceId: "trace_dlq_002", reason: "rate_limit", payload: { model: "Claude 3.5", query: "..." }, attempts: 2, maxAttempts: 5, lastError: "429 Too Many Requests", status: "pending", createdAt: Date.now() - 1800000, projectId: "" },
  { _id: "dlq3", traceId: "trace_dlq_003", reason: "invalid_response", payload: { model: "GPT-3.5", query: "..." }, attempts: 4, maxAttempts: 5, lastError: "Response validation failed: missing required fields", status: "failed", createdAt: Date.now() - 3600000, projectId: "" },
  { _id: "dlq4", traceId: "trace_dlq_004", reason: "auth_error", payload: { model: "Llama 3", query: "..." }, attempts: 1, maxAttempts: 5, lastError: "Authentication token expired", status: "pending", createdAt: Date.now() - 7200000, projectId: "" },
  { _id: "dlq5", traceId: "trace_dlq_005", reason: "model_unavailable", payload: { model: "GPT-4o", query: "..." }, attempts: 0, maxAttempts: 5, lastError: "Model at capacity", status: "pending", createdAt: Date.now() - 14400000, projectId: "" },
];

export default function DLQ() {
  const [search, setSearch] = useState("");
  const configured = isConvexConfigured();

  const { data: realData } = useConvexQuery<DLQEntry[]>(
    configured ? "dlq:list" : null,
    { projectId: CONFIG.projectId },
  );
  const data = realData ?? MOCK_DLQ;

  const filtered = data.filter(
    (d) =>
      d.reason?.toLowerCase().includes(search.toLowerCase()) ||
      d.traceId?.toLowerCase().includes(search.toLowerCase()) ||
      d.lastError?.toLowerCase().includes(search.toLowerCase()),
  );

  const pendingCount = data.filter((d) => d.status === "pending").length;
  const failedCount = data.filter((d) => d.status === "failed").length;

  const columns = [
    {
      key: "traceId",
      label: "Trace ID",
      render: (v: string) => <span className="font-mono text-xs text-primary">{v.slice(0, 14)}...</span>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (v: string) => <Badge>{v.replace("_", " ")}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (v: string) => (
        <div className="flex items-center gap-1.5">
          <StatusDot status={v as "success" | "error" | "warning" | "info"} />
          <span className="text-xs capitalize">{v}</span>
        </div>
      ),
    },
    {
      key: "attempts",
      label: "Attempts",
      render: (v: number, row: DLQEntry) => (
        <span className={`font-mono text-xs ${v >= row.maxAttempts ? "text-destructive" : "text-muted-foreground"}`}>
          {v}/{row.maxAttempts}
        </span>
      ),
    },
    {
      key: "lastError",
      label: "Last Error",
      render: (v: string) => (
        <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{v}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Age",
      render: (v: number) => (
        <span className="text-xs text-muted-foreground">
          {Math.floor((Date.now() - v) / 60000)}m ago
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_: unknown, row: DLQEntry) => (
        <div className="flex items-center gap-1">
          {row.status !== "succeeded" && (
            <Button variant="ghost" size="sm" title="Retry">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Dead Letter Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Failed trace ingestion requests — retry or discard errored payloads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{data.length} failed</Badge>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
            Retry All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Skull className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{data.length}</p>
              <p className="text-xs text-muted-foreground">Total entries</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Retryable</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Permanently failed</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative mb-4 max-w-sm">
        <input
          type="text"
          placeholder="Search by reason, trace ID, or error..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all"
        />
      </div>

      <Card>
        <CardHeader title="Failed Ingestion Requests" subtitle="DLQ entries" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Skull className="w-12 h-12" />}
            title="No failed entries"
            description="The dead letter queue is empty — all ingestion requests are processing successfully."
          />
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </Card>
    </AppShell>
  );
}