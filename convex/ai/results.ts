import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { deleteStorage } from "../lib";
import { location, itemType } from "../schema";

export const startProcessing = internalMutation({
  args: { screenshotId: v.id("screenshots") },
  handler: async (ctx, { screenshotId }) => {
    const shot = await ctx.db.get(screenshotId);
    if (!shot || !shot.storageId) return null;
    if (shot.status !== "uploaded" && shot.status !== "processing") return null;
    const attempts = shot.attempts + 1;
    await ctx.db.patch(screenshotId, { status: "processing", attempts });
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", shot.userId))
      .unique();
    return { storageId: shot.storageId, attempts, timezone: profile?.timezone ?? "America/Los_Angeles" };
  },
});

export const saveResult = internalMutation({
  args: {
    screenshotId: v.id("screenshots"),
    result: v.union(
      v.object({ sensitive: v.literal(true) }),
      v.object({
        sensitive: v.literal(false),
        type: itemType,
        title: v.string(),
        summary: v.string(),
        startsAt: v.optional(v.number()),
        endsAt: v.optional(v.number()),
        remindAt: v.optional(v.number()),
        location: v.optional(location),
        url: v.optional(v.string()),
        price: v.optional(v.string()),
        confidence: v.number(),
      }),
    ),
  },
  handler: async (ctx, { screenshotId, result }) => {
    const shot = await ctx.db.get(screenshotId);
    if (!shot) return;
    if (result.sensitive) {
      await deleteStorage(ctx, shot.storageId);
      await deleteStorage(ctx, shot.thumbStorageId);
      await ctx.db.patch(screenshotId, {
        status: "skipped",
        storageId: undefined,
        thumbStorageId: undefined,
        error: undefined,
      });
      return;
    }
    const existing = await ctx.db
      .query("items")
      .withIndex("by_screenshot", (q) => q.eq("screenshotId", screenshotId))
      .first();
    if (!existing) {
      const { sensitive: _, ...fields } = result;
      const itemId = await ctx.db.insert("items", {
        ...fields,
        userId: shot.userId,
        screenshotId,
        searchText: `${fields.title} ${fields.summary}`,
        state: "inbox",
        createdAt: Date.now(),
      });
      if (fields.type === "place" && fields.location?.address) {
        await ctx.scheduler.runAfter(0, internal.ai.geocode.geocodeItem, { itemId });
      }
    }
    await ctx.db.patch(screenshotId, { status: "done", error: undefined });
  },
});

export const markFailed = internalMutation({
  args: { screenshotId: v.id("screenshots"), error: v.string(), retry: v.boolean() },
  handler: async (ctx, { screenshotId, error, retry }) => {
    const shot = await ctx.db.get(screenshotId);
    if (!shot) return;
    await ctx.db.patch(screenshotId, { status: retry ? "uploaded" : "failed", error });
  },
});
