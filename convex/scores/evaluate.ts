import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// Re-score a trace using a specified scorer type
export const rescore = mutation({
  args: {
    traceId: v.id("traces"),
    scorerType: v.optional(v.union(v.literal("heuristic"), v.literal("model"), v.literal("hybrid"))),
  },
  handler: async (ctx, args) => {
    const trace = await ctx.db.get(args.traceId);
    if (!trace) throw new Error("Trace not found");

    // Simple heuristic re-scoring
    const scores: Record<string, number | undefined> = {};

    if (trace.userQuery && trace.response) {
      const qWords = new Set(trace.userQuery.toLowerCase().split(/\s+/));
      const rWords = trace.response.toLowerCase().split(/\s+/);
      const overlap = rWords.filter((w) => qWords.has(w)).length;
      scores.faithfulness = Math.min(1, overlap / Math.max(1, rWords.length));

      const ratio = trace.response.length / Math.max(1, trace.userQuery.length);
      scores.relevance = Math.min(1, Math.max(0, ratio / 10));
    }

    if (trace.response) {
      const toxicPatterns = [/hate/i, /violent/i, /illegal/i, /discriminat/i];
      const matched = toxicPatterns.filter((p) => p.test(trace.response)).length;
      scores.safety = Math.max(0, 1 - matched * 0.25);
    }

    const vals = Object.values(scores).filter((v) => v !== undefined) as number[];
    const overall = vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : undefined;

    // Store new evaluation
    return await ctx.db.insert("evaluationScores", {
      traceId: args.traceId,
      scorerType: args.scorerType ?? "heuristic",
      faithfulness: scores.faithfulness,
      relevance: scores.relevance,
      safety: scores.safety,
      overallScore: overall,
      details: { method: "rescore_v1", timestamp: Date.now() },
      createdAt: Date.now(),
    });
  },
});

// Get evaluation history for a trace
export const getByTrace = query({
  args: { traceId: v.id("traces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evaluationScores")
      .withIndex("by_trace", (q) => q.eq("traceId", args.traceId))
      .order("desc")
      .collect();
  },
});