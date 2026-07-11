// Core type definitions
// Optimized: shared BaseEntity avoids repeating _id / _creationTime on every type

interface BaseEntity {
  _id: string;
  _creationTime: number;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project extends BaseEntity {
  name: string;
  slug: string;
  organizationId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Trace extends BaseEntity {
  traceId: string;
  projectId: string;
  organizationId: string;
  model?: string;
  modelProvider?: string;
  userQuery?: string;
  response?: string;
  latencyMs?: number;
  tokenCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  status: "success" | "error" | "partial";
  environment?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  // Enriched fields
  evaluation?: EvaluationScore | null;
  feedback?: UserFeedback | null;
  alertCount?: number;
  alerts?: AlertEvent[];
}

export interface Span extends BaseEntity {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  type: "intent_router" | "retriever" | "llm" | "tool" | "response" | "guardrail";
  spanName: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  status?: string;
  model?: string;
  tokenCount?: number;
  costUsd?: number;
}

export interface RetrievedChunk extends BaseEntity {
  traceId: string;
  spanId: string;
  chunkIndex: number;
  source: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface EvaluationScore extends BaseEntity {
  traceId: string;
  scorerType: "heuristic" | "model" | "hybrid";
  faithfulness?: number;
  relevance?: number;
  safety?: number;
  overallScore?: number;
  details?: Record<string, unknown>;
  createdAt: number;
}

export interface UserFeedback extends BaseEntity {
  traceId: string;
  projectId: string;
  rating: number;
  comment?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface AlertRule extends BaseEntity {
  projectId: string;
  name: string;
  metric: "accuracy" | "latency" | "cost" | "error_rate" | "hallucination_score";
  condition: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  severity: "info" | "warning" | "critical";
  channels: ("in_app" | "email" | "webhook")[];
  evaluatorType?: "immediate" | "aggregate";
  aggregateWindow?: number;
  slackWebhook?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AlertEvent extends BaseEntity {
  ruleId: string;
  projectId: string;
  traceId?: string;
  severity: "info" | "warning" | "critical";
  message: string;
  evaluatedMetric: string;
  threshold: number;
  value: number;
  isRead: boolean;
  createdAt: number;
}

export interface FixRecord extends BaseEntity {
  traceId: string;
  projectId: string;
  description: string;
  status: "suggested" | "in_progress" | "completed" | "rejected";
  appliedBy?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface FailedIngestion extends BaseEntity {
  traceId: string;
  projectId: string;
  organizationId: string;
  payload: Record<string, unknown>;
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
  lastRetryAt?: number;
  status: "pending" | "retrying" | "failed" | "dead";
  createdAt: number;
}

export interface DashboardStats {
  totalTraces: number;
  errorTraces: number;
  partialTraces: number;
  successTraces: number;
  avgLatency: number;
  totalTokens: number;
  totalCost: number;
  errorRate: number;
  averageAccuracy: number;
  alertCount: number;
  timeSeries: { date: string; count: number; errors: number; cost: number }[];
  modelDistribution: { name: string; count: number; percentage: number }[];
  latencyBuckets: { label: string; min: number; max: number; count: number }[];
}

export interface FeedbackStats {
  totalFeedback: number;
  avgRating: number;
  distribution: { star: number; count: number }[];
  byCategory: { category: string; count: number }[];
}

// Navigation items
export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}