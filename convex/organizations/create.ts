import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      createdAt: now,
      updatedAt: now,
    });

    // Create default project
    const projectId = await ctx.db.insert("projects", {
      name: "Default Project",
      slug: "default",
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    });

    // Link user to organization
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.emailVerified ? identity.email ?? "" : ""))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        organizationIds: [...existingUser.organizationIds, orgId],
      });
    } else {
      await ctx.db.insert("users", {
        email: identity.email ?? "",
        name: identity.name ?? identity.email ?? "User",
        avatarUrl: identity.pictureUrl,
        organizationIds: [orgId],
        clerkId: identity.subject,
        createdAt: now,
      });
    }

    return { organizationId: orgId, projectId };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .first();

    if (!user) return [];

    const orgs = await Promise.all(
      user.organizationIds.map((id) => ctx.db.get(id)),
    );

    return orgs.filter(Boolean);
  },
});