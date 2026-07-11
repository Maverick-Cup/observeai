import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasExceededRateLimit(ctx: any, projectId: Id<"projects">): boolean {
  // Simple in-memory rate limiter — 100 req/min per project.
  // In production, use a distributed counter (Redis, etc.).
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 100;

  if (!rateLimitStore.has(projectId)) {
    rateLimitStore.set(projectId, []);
  }
  const timestamps = rateLimitStore.get(projectId)!.filter((t) => now - t < windowMs);
  timestamps.push(now);
  rateLimitStore.set(projectId, timestamps);
  return timestamps.length > maxRequests;
}
const rateLimitStore = new Map<string, number[]>();

// ─── Trace Ingestion (mutation, called via HTTP action) ─────────────────────────

export const ingest = mutation({
  args: {
    traceId: v.string(),
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
    spans: v.optional(
      v.array(
        v.object({
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
        }),
      ),
    ),
    retrievedChunks: v.optional(
      v.array(
        v.object({
          spanId: v.string(),
          chunkIndex: v.number(),
          source: v.string(),
          content: v.string(),
          score: v.optional(v.number()),
        }),
      ),
    ),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate via API key
    const keyHash = await hashApiKey(args.apiKey);
    const apiKeyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .first();

    if (!apiKeyDoc || !apiKeyDoc.isActive) {
      throw new Error("UNAUTHORIZED: Invalid or inactive API key");
    }

    const projectId = apiKeyDoc.projectId;
    const organizationId = apiKeyDoc.organizationId;

    // 2. Rate limit check
    if (hasExceededRateLimit(ctx, projectId)) {
      throw new Error("RATE_LIMITED: Too many requests (100/min)");
    }

    // 3. Idempotency check
    const existingTrace = await ctx.db
      .query("traces")
      .withIndex("by_trace_id", (q) => q.eq("traceId", args.traceId))
      .first();

    if (existingTrace) {
      return { status: "duplicate", traceId: existingTrace._id };
    }

    // 4. Create the trace
    const now = Date.now();
    const traceId = await ctx.db.insert("traces", {
      traceId: args.traceId,
      projectId,
      organizationId,
      model: args.model,
      modelProvider: args.modelProvider,
      userQuery: args.userQuery,
      response: args.response,
      latencyMs: args.latencyMs,
      tokenCount: args.tokenCount,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      costUsd: args.costUsd,
      status: args.status,
      environment: args.environment ?? "production",
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Store spans
    if (args.spans) {
      for (const span of args.spans) {
        await ctx.db.insert("spans", {
          traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          type: span.type,
          spanName: span.spanName,
          startTime: span.startTime,
          endTime: span.endTime,
          durationMs: span.durationMs,
          input: span.input,
          output: span.output,
          metadata: span.metadata,
          status: span.status,
          model: span.model,
          tokenCount: span.tokenCount,
          costUsd: span.costUsd,
        });
      }
    }

    // 6. Store retrieved chunks
    if (args.retrievedChunks && args.spans) {
      const spanMap = new Map(args.spans.map((s) => [s.spanId, traceId]));
      for (const chunk of args.retrievedChunks) {
        const matchingSpan = args.spans.find((s) => s.spanId === chunk.spanId);
        if (matchingSpan) {
          await ctx.db.insert("retrievedChunks", {
            traceId,
            spanId: traceId, // We need the actual span ID - find by spanId
            chunkIndex: chunk.chunkIndex,
            source: chunk.source,
            content: chunk.content,
            score: chunk.score,
          });
        }
      }
    }

    // 7. Evaluate trace (heuristic scoring)
    try {
      await evaluateTrace(ctx, traceId, args);
    } catch (evalError: any) {
      // Graceful degradation — store evaluation failure, never drop trace
      await ctx.db.insert("evaluationFailures", {
        traceId,
        scorerType: "heuristic",
        errorMessage: evalError.message ?? "Evaluation failed",
        errorStack: evalError.stack,
        createdAt: Date.now(),
      });
    }

    // 8. Evaluate alert rules
    try {
      await evaluateAlertRules(ctx, traceId, projectId, args);
    } catch {
      // Alert evaluation failure is non-critical
    }

    // 9. Update API key last used
    await ctx.db.patch(apiKeyDoc._id, {
      lastUsedAt: Date.now(),
    });

    return { status: "success", traceId };
  },
});

// ─── Internal: Heuristic Evaluation ─────────────────────────────────────────────

async function evaluateTrace(
  ctx: any,
  dbTraceId: Id<"traces">,
  args: any,
): Promise<void> {
  const scores: Record<string, number | undefined> = {};

  // Faithfulness: does response stay grounded in context?
  if (args.userQuery && args.response) {
    const qWords = new Set(args.userQuery.toLowerCase().split(/\s+/));
    const rWords = args.response.toLowerCase().split(/\s+/);
    const overlap = rWords.filter((w: string) => qWords.has(w)).length;
    scores.faithfulness = Math.min(1, overlap / Math.max(1, rWords.length));
  }

  // Relevance: response length relative to query (simple heuristic)
  if (args.userQuery && args.response) {
    const ratio = args.response.length / Math.max(1, args.userQuery.length);
    scores.relevance = Math.min(1, Math.max(0, ratio / 10));
  }

  // Safety: check for common toxic patterns (basic heuristic)
  if (args.response) {
    const toxicPatterns = [
      /hate/i, /violent/i, /illegal/i, /discriminat/i,
      /harmful/i, /dangerous/i, /weapon/i, /abuse/i,
    ];
    const matched = toxicPatterns.filter((p) => p.test(args.response)).length;
    scores.safety = Math.max(0, 1 - matched * 0.25);
  }

  // Overall score (weighted average)
  const vals = Object.values(scores).filter((v) => v !== undefined) as number[];
  const overall = vals.length > 0
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : undefined;

  await ctx.db.insert("evaluationScores", {
    traceId: dbTraceId,
    scorerType: "heuristic",
    faithfulness: scores.faithfulness,
    relevance: scores.relevance,
    safety: scores.safety,
    overallScore: overall,
    details: { method: "heuristic_v1", wordCount: args.response?.split(/\s+/).length },
    createdAt: Date.now(),
  });
}

// ─── Internal: Alert Rule Evaluation ────────────────────────────────────────────

async function evaluateAlertRules(
  ctx: any,
  dbTraceId: Id<"traces">,
  projectId: Id<"projects">,
  args: any,
): Promise<void> {
  const rules = await ctx.db
    .query("alertRules")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  for (const rule of rules) {
    if (!rule.isActive) continue;

    let value: number | undefined;
    let metricLabel = rule.metric;

    switch (rule.metric) {
      case "latency":
        value = args.latencyMs ?? 0;
        break;
      case "cost":
        value = args.costUsd ?? 0;
        break;
      case "error_rate":
        value = args.status === "error" ? 1 : 0;
        break;
      case "accuracy":
      case "hallucination_score":
        // These need evaluation scores — check if we have them
        const scores = await ctx.db
          .query("evaluationScores")
          .withIndex("by_trace", (q: any) => q.eq("traceId", dbTraceId))
          .first();
        if (scores) {
          value = rule.metric === "accuracy"
            ? scores.overallScore ?? 0
            : 1 - (scores.faithfulness ?? 0);
        }
        break;
    }

    if (value === undefined) continue;

    let triggered = false;
    switch (rule.condition) {
      case "gt": triggered = value > rule.threshold; break;
      case "lt": triggered = value < rule.threshold; break;
      case "gte": triggered = value >= rule.threshold; break;
      case "lte": triggered = value <= rule.threshold; break;
    }

    if (triggered) {
      const message = `Rule "${rule.name}": ${metricLabel} = ${value} (threshold: ${rule.condition} ${rule.threshold})`;
      await ctx.db.insert("alertEvents", {
        ruleId: rule._id,
        projectId,
        traceId: dbTraceId,
        severity: rule.severity,
        message,
        evaluatedMetric: metricLabel,
        threshold: rule.threshold,
        value,
        isRead: false,
        createdAt: Date.now(),
      });
    }
  }
}