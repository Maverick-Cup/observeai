import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const list = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    status: v.optional(v.union(v.literal("pending"), v.literal("retrying"), v.literal("failed"), v.literal("dead"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("failedIngestion")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    return await query.order("desc").take(args.limit ?? 50);
  },
});

export const retry = mutation({
  args: { failedId: v.id("failedIngestion") },
  handler: async (ctx, args) => {
    const failed = await ctx.db.get(args.failedId);
    if (!failed) throw new Error("DLQ entry not found");

    await ctx.db.patch(args.failedId, {
      status: "retrying",
      retryCount: failed.retryCount + 1,
      lastRetryAt: Date.now(),
    });

    // In production, this would re-queue to the ingestion pipeline
    // For now, mark it for manual retry
    return { status: "queued", traceId: failed.traceId };
  },
});

export const retryAll = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("failedIngestion")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "failed")))
      .collect();

    for (const entry of pending) {
      await ctx.db.patch(entry._id, {
        status: "retrying",
        retryCount: entry.retryCount + 1,
        lastRetryAt: Date.now(),
      });
    }

    return { retried: pending.length };
  },
});

export const remove = mutation({
  args: { failedId: v.id("failedIngestion") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.failedId);
  },
});