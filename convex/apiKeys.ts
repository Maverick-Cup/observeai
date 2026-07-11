/**
 * API Key Management — list, generate, and revoke keys.
 *
 * These functions require the user to be authenticated via Convex Auth.
 * The generated key is returned in plain text ONCE (at creation time).
 * Only the SHA-256 hash is stored in the database.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKeyString(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "key";
  const uuid = crypto.randomUUID();
  return `sk-observeai-${slug}-${uuid}`;
}

async function getProjectId(ctx: any): Promise<{ projectId: any; organizationId: any } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // Find the user's profile
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_email", (q: any) => q.eq("email", identity.email ?? ""))
    .first();
  if (!profile || profile.organizationIds.length === 0) return null;

  const organizationId = profile.organizationIds[0];

  // Find the first project for this org
  const project = await ctx.db
    .query("projects")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
    .first();
  if (!project) return null;

  return { projectId: project._id, organizationId };
}

// ─── List API Keys ──────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ids = await getProjectId(ctx);
    if (!ids) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q: any) => q.eq("projectId", ids.projectId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      label: k.label,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      isActive: k.isActive,
      // NEVER return keyHash to the client
    }));
  },
});

// ─── Generate API Key ───────────────────────────────────────────────────────────

export const generate = mutation({
  args: {
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const ids = await getProjectId(ctx);
    if (!ids) throw new Error("NOT_FOUND: No project found for this user");

    const rawKey = generateKeyString(args.label);
    const keyHash = await hashApiKey(rawKey);

    await ctx.db.insert("apiKeys", {
      keyHash,
      label: args.label,
      projectId: ids.projectId,
      organizationId: ids.organizationId,
      createdAt: Date.now(),
      isActive: true,
    });

    return { key: rawKey };
  },
});

// ─── Revoke API Key ─────────────────────────────────────────────────────────────

export const revoke = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const ids = await getProjectId(ctx);
    if (!ids) throw new Error("UNAUTHORIZED: Not authenticated");

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("NOT_FOUND: API key not found");
    if (key.projectId !== ids.projectId) throw new Error("FORBIDDEN: Cannot revoke key from another project");

    await ctx.db.patch(args.keyId, {
      isActive: false,
    });

    return { status: "revoked", keyId: args.keyId };
  },
});