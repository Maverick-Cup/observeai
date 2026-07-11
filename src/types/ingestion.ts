/**
 * Inbound Ingestion Types — data coming INTO ObserveAI from legacy systems
 */

export type IngestionFormat =
  | "json"
  | "ndjson"
  | "syslog"
  | "otel"
  | "csv"
  | "raw";

export type IngestionSource =
  | "rest_api"
  | "syslog_daemon"
  | "cloudwatch"
  | "otel_collector"
  | "csv_upload"
  | "cli_push"
  | "mcp_tool";

export type IngestionStatus =
  | "received"
  | "validating"
  | "transforming"
  | "processing"
  | "completed"
  | "failed"
  | "rejected";

export interface IngestEvent {
  id: string;
  traceId?: string;
  source: IngestionSource;
  format: IngestionFormat;
  body: unknown;
  receivedAt: number;
  status: IngestionStatus;
  errorMessage?: string;
  processingLatencyMs?: number;
}

export interface IngestBatch {
  id: string;
  source: IngestionSource;
  format: IngestionFormat;
  events: IngestEvent[];
  receivedAt: number;
  completedAt?: number;
  status: IngestionStatus;
  eventCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs?: number;
  metadata?: Record<string, string>;
}

export interface IngestIntegration {
  id: string;
  name: string;
  description: string;
  source: IngestionSource;
  format: IngestionFormat;
  apiKey: string;
  isActive: boolean;
  endpointUrl: string;
  createdAt: number;
  lastUsedAt?: number;
  totalIngested: number;
  totalErrors: number;
  rateLimitPerMinute: number;
}

export interface IngestPipelineStats {
  totalReceived: number;
  totalCompleted: number;
  totalFailed: number;
  totalRejected: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  throughputPerMinute: number;
  topErrors: Array<{ message: string; count: number }>;
  integrations: Array<{
    name: string;
    source: IngestionSource;
    events24h: number;
    errorRate: number;
    lastEventAt?: number;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: "error" | "warning";
  }>;
}

export interface TransformationResult {
  success: boolean;
  traceId?: string;
  spans?: Array<{
    name: string;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
    metadata?: Record<string, unknown>;
  }>;
  errorMessage?: string;
}