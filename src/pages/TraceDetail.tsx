import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { ArrowLeft, Clock, GitBranch, RotateCcw } from "lucide-react";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";

// Fallback mock trace when Convex not configured
const MOCK_TRACE = {
  _id: "trace_fallback",
  traceId: "trace_abc123def456",
  userQuery: "What are the side effects of taking ibuprofen with blood thinners?",
  response: "Ibuprofen can increase bleeding risk when taken with blood thinners like warfarin...",
  model: "GPT-4o",
  modelProvider: "OpenAI",
  latencyMs: 2340,
  tokenCount: 1456,
  promptTokens: 890,
  completionTokens: 566,
  costUsd: 0.0234,
  status: "success",
  environment: "production",
  createdAt: Date.now() - 3600000,
  evaluation: {
    overallScore: 0.92,
    faithfulness: 0.95,
    relevance: 0.88,
    safety: 0.98,
  },
  spans: [
    { spanId: "s1", type: "intent_router", spanName: "Intent Classification", startTime: Date.now() - 3600000, durationMs: 45, status: "success" },
    { spanId: "s2", type: "retriever", spanName: "Knowledge Base Retrieval", startTime: Date.now() - 3599955, durationMs: 120, status: "success", metadata: { chunks_retrieved: 3 } },
    { spanId: "s3", parentSpanId: "s2", type: "llm", spanName: "Context Assembly", startTime: Date.now() - 3599835, durationMs: 890, status: "success", model: "GPT-4o", tokenCount: 1456 },
    { spanId: "s4", type: "guardrail", spanName: "Safety Check", startTime: Date.now() - 3598945, durationMs: 35, status: "success" },
    { spanId: "s5", type: "response", spanName: "Response Generation", startTime: Date.now() - 3598910, durationMs: 1250, status: "success", tokenCount: 566 },
  ],
  retrievedChunks: [
    { chunkIndex: 0, source: "medical_database/medications.md", content: "NSAIDs like ibuprofen increase bleeding risk when combined with anticoagulants...", score: 0.92 },
    { chunkIndex: 1, source: "medical_database/side_effects.md", content: "Common side effects include dyspepsia, heartburn, nausea, and increased bleeding time.", score: 0.88 },
    { chunkIndex: 2, source: "pharma_db/interactions.md", content: "Warfarin + NSAIDs: Monitor INR closely. Increased risk of GI bleeding.", score: 0.85 },
  ],
  alertEvents: [] as Array<Record<string, unknown>>,
  feedback: null,
  fixRecords: [] as Array<Record<string, unknown>>,
};

type Span = {
  spanId: string;
  type: string;
  spanName: string;
  startTime: number;
  durationMs: number;
  status: string;
  parentSpanId?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  tokenCount?: number;
};

type RetrievedChunk = {
  chunkIndex: number;
  source: string;
  content: string;
  score: number;
};

type TraceDetailData = {
  _id: string;
  traceId: string;
  userQuery: string;
  response: string;
  model: string;
  modelProvider: string;
  latencyMs: number;
  tokenCount: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status: string;
  environment: string;
  createdAt: number;
  evaluation: {
    overallScore: number;
    faithfulness: number;
    relevance: number;
    safety: number;
  };
  spans: Span[];
  retrievedChunks: RetrievedChunk[];
  alertEvents: Array<Record<string, unknown>>;
  feedback: Record<string, unknown> | null;
  fixRecords: Array<Record<string, unknown>>;
};

export default function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();

  const configured = isConvexConfigured();
  const { data: realTrace, loading } = useConvexQuery<TraceDetailData>(
    configured && traceId ? "traces:get" : null,
    { traceId },
  );
  const trace = realTrace ?? (traceId === "trace_fallback" || !configured ? MOCK_TRACE : null);

  if (loading && configured) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!trace) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Trace not found</p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/traces")} className="mt-2">
            Back to Traces
          </Button>
        </div>
      </AppShell>
    );
  }

  const spanStart = trace.spans[0]?.startTime ?? trace.createdAt;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/traces")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground font-mono text-sm">
              {trace.traceId?.slice(0, 16)}...
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(trace.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={trace.environment === "production" ? "info" : "neutral"}>{trace.environment}</Badge>
          <Badge variant="success">{trace.model}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trace Info + Waterfall */}
        <div className="lg:col-span-2 space-y-6">
          {/* Query & Response */}
          <Card>
            <CardHeader title="Input" subtitle="User query" />
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-foreground">{trace.userQuery}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Output" subtitle="AI response" />
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-foreground leading-relaxed">{trace.response}</p>
            </div>
          </Card>

          {/* Waterfall Timeline */}
          <Card>
            <CardHeader title="Span Timeline" subtitle="Request waterfall" />
            <div className="space-y-2">
              {trace.spans.map((span) => {
                const startOffset = span.startTime - spanStart;
                return (
                  <div key={span.spanId} className="flex items-center gap-4 p-3 bg-background/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 w-40 flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full ${span.status === "success" ? "bg-success" : "bg-destructive"}`} />
                      <span className="text-xs font-medium text-foreground">{span.spanName}</span>
                    </div>
                    <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="absolute h-full bg-primary/30 rounded"
                        style={{
                          left: `${(startOffset / trace.latencyMs) * 100}%`,
                          width: `${Math.max(5, (span.durationMs ?? 50) / trace.latencyMs * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="font-mono text-xs text-muted-foreground">{span.durationMs}ms</span>
                    </div>
                    {span.tokenCount && (
                      <span className="text-[10px] text-muted-foreground">{span.tokenCount} tokens</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Retrieved Chunks */}
          {trace.retrievedChunks && trace.retrievedChunks.length > 0 && (
            <Card>
              <CardHeader title="Retrieved Chunks" subtitle="RAG context sources" />
              <div className="space-y-3">
                {trace.retrievedChunks.map((chunk) => (
                  <div key={chunk.chunkIndex} className="p-3 bg-background/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-xs text-primary">{chunk.source}</code>
                      <Badge variant={chunk.score > 0.9 ? "success" : "info"}>{(chunk.score * 100).toFixed(0)}% match</Badge>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Evaluation + Details */}
        <div className="space-y-6">
          {/* Evaluation Scores */}
          {trace.evaluation && (
            <Card>
              <CardHeader title="Evaluation Scores" subtitle="Heuristic assessment" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Overall</span>
                  <span className={`font-heading text-lg font-bold ${
                    (trace.evaluation.overallScore ?? 0) > 0.8 ? "text-success" : "text-warning"
                  }`}>
                    {((trace.evaluation.overallScore ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Faithfulness</span>
                    <Badge variant={(trace.evaluation.faithfulness ?? 0) > 0.8 ? "success" : "warning"}>
                      {((trace.evaluation.faithfulness ?? 0) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Relevance</span>
                    <Badge variant={(trace.evaluation.relevance ?? 0) > 0.8 ? "success" : "warning"}>
                      {((trace.evaluation.relevance ?? 0) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Safety</span>
                    <Badge variant={(trace.evaluation.safety ?? 0) > 0.8 ? "success" : "destructive"}>
                      {((trace.evaluation.safety ?? 0) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader title="Details" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-xs">{trace.latencyMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens</span>
                <span className="font-mono text-xs">{trace.tokenCount?.toLocaleString()}</span>
              </div>
              {trace.promptTokens != null && trace.completionTokens != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prompt → Completion</span>
                  <span className="font-mono text-xs">{trace.promptTokens} → {trace.completionTokens}</span>
                </div>
              )}
              {trace.costUsd != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-mono text-xs">${trace.costUsd.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="text-xs">{trace.model}</span>
              </div>
              {trace.modelProvider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-xs">{trace.modelProvider}</span>
                </div>
              )}
            </div>
          </Card>

          {/* What to Fix */}
          <Card>
            <CardHeader title="What to Fix" subtitle="Suggestions for improvement" />
            <div className="space-y-2">
              <div className="p-3 bg-background/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="w-3.5 h-3.5 text-info" />
                  <span className="text-xs font-medium text-foreground">Add dosage context</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The response doesn't include specific dosage information or when to seek emergency care.
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                <GitBranch className="w-4 h-4" />
                Create Fix Record
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}