import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("projects", {
      name: args.name,
      slug: args.slug,
      organizationId: args.organizationId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// Generate a new API key for a project
export const generateApiKey = mutation({
  args: {
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate a random API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = "observe_" + Array.from(keyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Hash it for storage
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await ctx.db.insert("apiKeys", {
      keyHash,
      label: args.label,
      projectId: args.projectId,
      organizationId: args.organizationId,
      createdAt: Date.now(),
      isActive: true,
    });

    return { apiKey }; // Return the raw key ONLY once
  },
});

export const listApiKeys = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
      .then((keys) => keys.map((k) => ({
        ...k,
        keyHash: k.keyHash.slice(0, 12) + "...", // Only show prefix
      })));
  },
});