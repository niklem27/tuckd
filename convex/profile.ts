import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deleteStorage, requireUser } from "./lib";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx).catch(() => null);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return { userId, profile };
  },
});

export const upsert = mutation({
  args: {
    timezone: v.optional(v.string()),
    briefEnabled: v.optional(v.boolean()),
    onboarded: v.optional(v.boolean()),
    lastSyncedAt: v.optional(v.number()),
    autoScanPhotos: v.optional(v.boolean()),
    deleteOriginals: v.optional(v.boolean()),
    lastPhotoSyncAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const patch = Object.fromEntries(Object.entries(args).filter(([, val]) => val !== undefined));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, patch);
      return profile._id;
    }
    return await ctx.db.insert("profiles", {
      userId,
      timezone: args.timezone ?? "UTC",
      briefEnabled: args.briefEnabled ?? true,
      onboarded: args.onboarded ?? false,
      lastSyncedAt: args.lastSyncedAt,
    });
  },
});

export const deleteAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    for (const state of ["inbox", "kept", "archived", "done"] as const) {
      const items = await ctx.db
        .query("items")
        .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", state))
        .collect();
      for (const item of items) await ctx.db.delete(item._id);
    }
    const shots = await ctx.db
      .query("screenshots")
      .withIndex("by_user_asset", (q) => q.eq("userId", userId))
      .collect();
    for (const shot of shots) {
      await deleteStorage(ctx, shot.storageId);
      await deleteStorage(ctx, shot.thumbStorageId);
      await ctx.db.delete(shot._id);
    }
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { lastSyncedAt: undefined });
  },
});
