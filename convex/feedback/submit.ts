import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const submit = mutation({
  args: {
    traceId: v.id("traces"),
    projectId: v.id("projects"),
    rating: v.number(),
    comment: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userFeedback", {
      traceId: args.traceId,
      projectId: args.projectId,
      rating: args.rating,
      comment: args.comment,
      category: args.category,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userFeedback")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const allFeedback = await ctx.db
      .query("userFeedback")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const totalFeedback = allFeedback.length;
    if (totalFeedback === 0) {
      return { totalFeedback, avgRating: 0, distribution: [] };
    }

    const avgRating = allFeedback.reduce((s, f) => s + f.rating, 0) / totalFeedback;
    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: allFeedback.filter((f) => f.rating === star).length,
    }));

    const byCategory: Record<string, number> = {};
    for (const f of allFeedback) {
      if (f.category) {
        byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      }
    }

    return {
      totalFeedback,
      avgRating,
      distribution,
      byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
    };
  },
});