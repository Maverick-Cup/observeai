import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    organizationIds: v.array(v.id("organizations")),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    organizationId: v.id("organizations"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_slug", ["organizationId", "slug"]),

  apiKeys: defineTable({
    keyHash: v.string(),
    label: v.string(),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_key_hash", ["keyHash"])
    .index("by_project", ["projectId"]),

  traces: defineTable({
    traceId: v.string(),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    model: v.optional(v.string()),
    modelProvider: v.optional(v.string()),
    userQuery: v.optional(v.string()),
    response: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    tokenCount: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("partial")),
    environment: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_trace_id", ["traceId"])
    .index("by_project", ["projectId", "createdAt"])
    .index("by_organization", ["organizationId", "createdAt"])
    .index("by_org_status", ["organizationId", "status", "createdAt"])
    .index("by_project_env", ["projectId", "environment", "createdAt"]),

  spans: defineTable({
    traceId: v.id("traces"),
    spanId: v.string(),
    parentSpanId: v.optional(v.string()),
    type: v.union(
      v.literal("intent_router"),
      v.literal("retriever"),
      v.literal("llm"),
      v.literal("tool"),
      v.literal("response"),
      v.literal("guardrail"),
    ),
    spanName: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    metadata: v.optional(v.any()),
    status: v.optional(v.string()),
    model: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    costUsd: v.optional(v.number()),
  })
    .index("by_trace", ["traceId", "startTime"])
    .index("by_span_id", ["spanId"]),

  retrievedChunks: defineTable({
    traceId: v.id("traces"),
    spanId: v.id("spans"),
    chunkIndex: v.number(),
    source: v.string(),
    content: v.string(),
    score: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_trace", ["traceId"])
    .index("by_span", ["spanId"]),

  evaluationScores: defineTable({
    traceId: v.id("traces"),
    scorerType: v.union(v.literal("heuristic"), v.literal("model"), v.literal("hybrid")),
    faithfulness: v.optional(v.number()),
    relevance: v.optional(v.number()),
    safety: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    details: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_trace", ["traceId"]),

  evaluationFailures: defineTable({
    traceId: v.id("traces"),
    scorerType: v.string(),
    errorMessage: v.string(),
    errorStack: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trace", ["traceId"]),

  userFeedback: defineTable({
    traceId: v.id("traces"),
    projectId: v.id("projects"),
    rating: v.number(),
    comment: v.optional(v.string()),
    category: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_trace", ["traceId"])
    .index("by_project", ["projectId", "createdAt"]),

  alertRules: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    metric: v.union(
      v.literal("accuracy"),
      v.literal("latency"),
      v.literal("cost"),
      v.literal("error_rate"),
      v.literal("hallucination_score"),
    ),
    condition: v.union(v.literal("gt"), v.literal("lt"), v.literal("gte"), v.literal("lte")),
    threshold: v.number(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    channels: v.array(v.union(v.literal("in_app"), v.literal("email"), v.literal("webhook"))),
    evaluatorType: v.optional(v.union(v.literal("immediate"), v.literal("aggregate"))),
    aggregateWindow: v.optional(v.number()),
    slackWebhook: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"]),

  alertEvents: defineTable({
    ruleId: v.id("alertRules"),
    projectId: v.id("projects"),
    traceId: v.optional(v.id("traces")),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    message: v.string(),
    evaluatedMetric: v.string(),
    threshold: v.number(),
    value: v.number(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId", "createdAt"])
    .index("by_rule", ["ruleId"])
    .index("by_unread", ["projectId", "isRead", "createdAt"]),

  fixRecords: defineTable({
    traceId: v.id("traces"),
    projectId: v.id("projects"),
    description: v.string(),
    status: v.union(v.literal("suggested"), v.literal("in_progress"), v.literal("completed"), v.literal("rejected")),
    appliedBy: v.optional(v.id("profiles")),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_trace", ["traceId"])
    .index("by_project", ["projectId"]),

  failedIngestion: defineTable({
    traceId: v.string(),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    payload: v.any(),
    errorMessage: v.string(),
    errorStack: v.optional(v.string()),
    retryCount: v.number(),
    lastRetryAt: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("retrying"), v.literal("failed"), v.literal("dead")),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId", "createdAt"])
    .index("by_status", ["status"]),
});