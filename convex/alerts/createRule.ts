import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const createRule = mutation({
  args: {
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
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("alertRules", {
      projectId: args.projectId,
      name: args.name,
      metric: args.metric,
      condition: args.condition,
      threshold: args.threshold,
      severity: args.severity,
      channels: args.channels,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRule = mutation({
  args: {
    ruleId: v.id("alertRules"),
    name: v.optional(v.string()),
    metric: v.optional(v.string()),
    condition: v.optional(v.string()),
    threshold: v.optional(v.number()),
    severity: v.optional(v.string()),
    channels: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.threshold !== undefined) patch.threshold = args.threshold;
    await ctx.db.patch(args.ruleId, patch);
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("alertRules") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ruleId);
  },
});

export const listRules = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alertRules")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const listEvents = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("alertEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    if (args.unreadOnly) {
      query = query.filter((q) => q.eq(q.field("isRead"), false));
    }

    return await query.order("desc").take(args.limit ?? 50);
  },
});

export const markEventRead = mutation({
  args: { eventId: v.id("alertEvents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { isRead: true });
  },
});

export const markAllRead = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("alertEvents")
      .withIndex("by_unread", (q) => q.eq("projectId", args.projectId).eq("isRead", false))
      .collect();
    for (const event of unread) {
      await ctx.db.patch(event._id, { isRead: true });
    }
  },
});

export const getUnreadCount = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("alertEvents")
      .withIndex("by_unread", (q) => q.eq("projectId", args.projectId).eq("isRead", false))
      .collect();
    return unread.length;
  },
});