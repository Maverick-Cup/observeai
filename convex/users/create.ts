import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .first();

    if (!user) return null;

    // Get organizations and their projects
    const organizations = await Promise.all(
      user.organizationIds.map((id) => ctx.db.get(id)),
    );

    const projects = await Promise.all(
      organizations
        .filter(Boolean)
        .map((org) =>
          ctx.db
            .query("projects")
            .withIndex("by_organization", (q) => q.eq("organizationId", org!._id))
            .collect(),
        ),
    );

    return {
      ...user,
      organizations: organizations.filter(Boolean),
      projects: projects.flat(),
    };
  },
});

export const createFromIdentity = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      organizationIds: [],
      clerkId: identity.subject,
      createdAt: Date.now(),
    });
  },
});