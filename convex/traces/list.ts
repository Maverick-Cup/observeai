import { v } from "convex/values";
import { query } from "../_generated/server";

// List traces with pagination and filters
export const list = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(v.union(v.literal("success"), v.literal("error"), v.literal("partial"))),
    environment: v.optional(v.string()),
    model: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    minScore: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("traces")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    if (args.cursor) {
      const cursor = JSON.parse(args.cursor) as { createdAt: number; traceId: string };
      query = query.filter((q) => q.gte(q.field("createdAt"), cursor.createdAt));
    }

    const traces = await query.order("desc").take(args.limit ?? 50);

    const enriched = await Promise.all(
      traces.map(async (trace) => {
        const evalScore = await ctx.db
          .query("evaluationScores")
          .withIndex("by_trace", (q) => q.eq("traceId", trace._id))
          .first();

        const feedback = await ctx.db
          .query("userFeedback")
          .withIndex("by_trace", (q) => q.eq("traceId", trace._id))
          .first();

        const alertEvents = await ctx.db
          .query("alertEvents")
          .filter((q) => q.eq(q.field("traceId"), trace._id))
          .take(5);

        return {
          ...trace,
          evaluation: evalScore ?? null,
          feedback: feedback ?? null,
          alertCount: alertEvents.length,
          alerts: alertEvents,
        };
      }),
    );

    const nextCursor = traces.length === (args.limit ?? 50)
      ? JSON.stringify({ createdAt: traces[traces.length - 1].createdAt })
      : null;

    return { traces: enriched, nextCursor };
  },
});

// Get single trace with all related data
export const get = query({
  args: { traceId: v.id("traces") },
  handler: async (ctx, args) => {
    const trace = await ctx.db.get(args.traceId);
    if (!trace) return null;

    const spans = await ctx.db
      .query("spans")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .order("asc")
      .collect();

    const retrievedChunks = await ctx.db
      .query("retrievedChunks")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .collect();

    const evaluation = await ctx.db
      .query("evaluationScores")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .first();

    const evaluationFailures = await ctx.db
      .query("evaluationFailures")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .collect();

    const feedback = await ctx.db
      .query("userFeedback")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .collect();

    const fixRecords = await ctx.db
      .query("fixRecords")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .collect();

    const alertEvents = await ctx.db
      .query("alertEvents")
      .filter((q) => q.eq(q.field("traceId"), args.traceId))
      .collect();

    return {
      ...trace,
      spans,
      retrievedChunks,
      evaluation,
      evaluationFailures,
      feedback,
      fixRecords,
      alertEvents,
    };
  },
});

// Get traces flagged as "bad" (low evaluation scores)
export const listBadAnswers = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    minSeverity: v.optional(v.union(v.literal("all"), v.literal("critical"), v.literal("warning"), v.literal("info"))),
    hasFeedback: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const traces = await ctx.db
      .query("traces")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 50);

    const flagged = await Promise.all(
      traces.map(async (trace) => {
        const evaluation = await ctx.db
          .query("evaluationScores")
          .withIndex("by_trace", (q) => q.eq("traceId", trace._id))
          .first();

        const feedback = await ctx.db
          .query("userFeedback")
          .withIndex("by_trace", (q) => q.eq("traceId", trace._id))
          .first();

        const fixRecord = await ctx.db
          .query("fixRecords")
          .withIndex("by_trace", (q) => q.eq("traceId", trace._id))
          .first();

        // Flag if overall score < 0.7 or user feedback rating < 3
        const isFlagged = (evaluation?.overallScore ?? 1) < 0.7 || (feedback?.rating ?? 5) < 3;
        if (!isFlagged) return null;

        return {
          ...trace,
          evaluation,
          feedback,
          fixRecord,
        };
      }),
    );

    return flagged.filter(Boolean);
  },
});

// Dashboard statistics
export const stats = query({
  args: {
    projectId: v.id("projects"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.endDate ?? Date.now();
    const start = args.startDate ?? now - 7 * 24 * 60 * 60 * 1000; // 7 days

    const traces = await ctx.db
      .query("traces")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.gte(q.field("createdAt"), start))
      .collect();

    const totalTraces = traces.length;
    const errorTraces = traces.filter((t) => t.status === "error").length;
    const partialTraces = traces.filter((t) => t.status === "partial").length;
    const successTraces = traces.filter((t) => t.status === "success").length;

    const totalLatency = traces.reduce((sum, t) => sum + (t.latencyMs ?? 0), 0);
    const avgLatency = totalTraces > 0 ? totalLatency / totalTraces : 0;

    const totalTokens = traces.reduce((sum, t) => sum + (t.tokenCount ?? 0), 0);
    const totalCost = traces.reduce((sum, t) => sum + (t.costUsd ?? 0), 0);

    // Error rate
    const errorRate = totalTraces > 0 ? errorTraces / totalTraces : 0;

    // Get evaluation scores for traces
    const traceIds = traces.map((t) => t._id);
    let avgScore = 0;
    let scoreCount = 0;
    for (const tid of traceIds) {
      const evalScore = await ctx.db
        .query("evaluationScores")
        .withIndex("by_trace", (q) => q.eq("traceId", tid))
        .first();
      if (evalScore?.overallScore !== undefined) {
        avgScore += evalScore.overallScore;
        scoreCount++;
      }
    }
    const averageAccuracy = scoreCount > 0 ? avgScore / scoreCount : 0;

    // Alert counts
    const alertCount = await ctx.db
      .query("alertEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.gte(q.field("createdAt"), start))
      .collect()
      .then((a) => a.length);

    // Traces by model
    const byModel: Record<string, number> = {};
    for (const t of traces) {
      const model = t.model ?? "unknown";
      byModel[model] = (byModel[model] ?? 0) + 1;
    }

    // Traces per day (for chart)
    const byDay: Record<string, { count: number; errors: number; cost: number }> = {};
    for (const t of traces) {
      const day = new Date(t.createdAt).toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { count: 0, errors: 0, cost: 0 };
      byDay[day].count++;
      if (t.status === "error") byDay[day].errors++;
      byDay[day].cost += t.costUsd ?? 0;
    }

    // Model distribution
    const modelDistribution = Object.entries(byModel)
      .map(([name, count]) => ({ name, count, percentage: totalTraces > 0 ? count / totalTraces : 0 }))
      .sort((a, b) => b.count - a.count);

    // Latency histogram buckets (0-100ms, 100-500ms, 500-1000ms, 1000-3000ms, 3000ms+)
    const latencyBuckets = [
      { label: "0-100ms", min: 0, max: 100, count: 0 },
      { label: "100-500ms", min: 100, max: 500, count: 0 },
      { label: "500-1s", min: 500, max: 1000, count: 0 },
      { label: "1-3s", min: 1000, max: 3000, count: 0 },
      { label: "3s+", min: 3000, max: Infinity, count: 0 },
    ];
    for (const t of traces) {
      const latency = t.latencyMs ?? 0;
      const bucket = latencyBuckets.find((b) => latency >= b.min && latency < b.max);
      if (bucket) bucket.count++;
    }

    return {
      totalTraces,
      errorTraces,
      partialTraces,
      successTraces,
      avgLatency,
      totalTokens,
      totalCost,
      errorRate,
      averageAccuracy,
      alertCount,
      timeSeries: Object.entries(byDay)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      modelDistribution,
      latencyBuckets,
    };
  },
});

// Top expensive traces
export const topExpensive = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("traces")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.neq(q.field("costUsd"), undefined))
      .order("desc")
      .take(args.limit ?? 20);
  },
});