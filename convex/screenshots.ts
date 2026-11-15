import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { ownedScreenshot, requireUser } from "./lib";

export const registerScreenshot = mutation({
  args: { assetId: v.string(), takenAt: v.number() },
  handler: async (ctx, { assetId, takenAt }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("screenshots")
      .withIndex("by_user_asset", (q) => q.eq("userId", userId).eq("assetId", assetId))
      .unique();
    if (existing && existing.status !== "pending" && existing.status !== "failed") {
      return { alreadyExists: true as const };
    }
    const screenshotId =
      existing?._id ??
      (await ctx.db.insert("screenshots", {
        userId,
        assetId,
        takenAt,
        status: "pending",
        attempts: 0,
      }));
    if (existing) await ctx.db.patch(existing._id, { status: "pending", attempts: 0, error: undefined });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const thumbUploadUrl = await ctx.storage.generateUploadUrl();
    return { screenshotId, uploadUrl, thumbUploadUrl };
  },
});

export const attachUpload = mutation({
  args: {
    screenshotId: v.id("screenshots"),
    storageId: v.id("_storage"),
    thumbStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { screenshotId, storageId, thumbStorageId }) => {
    const userId = await requireUser(ctx);
    const shot = await ownedScreenshot(ctx, userId, screenshotId);
    if (shot.status !== "pending") return;
    const meta = await ctx.db.system.get(storageId);
    await ctx.db.patch(screenshotId, {
      storageId,
      thumbStorageId,
      status: "uploaded",
      bytes: meta?.size,
    });
    await ctx.scheduler.runAfter(0, internal.ai.processScreenshot.processScreenshot, { screenshotId });
  },
});

export const syncStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx).catch(() => null);
    const counts = { pending: 0, uploaded: 0, processing: 0, done: 0, skipped: 0, failed: 0 };
    if (!userId) return { ...counts, sorting: 0, total: 0 };
    for (const status of Object.keys(counts) as (keyof typeof counts)[]) {
      const rows = await ctx.db
        .query("screenshots")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
        .collect();
      counts[status] = rows.length;
    }
    const sorting = counts.pending + counts.uploaded + counts.processing;
    const total = sorting + counts.done + counts.skipped + counts.failed;
    return { ...counts, sorting, total };
  },
});

export const photoScans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx).catch(() => null);
    if (!userId) return [];
    const shots = await ctx.db
      .query("screenshots")
      .withIndex("by_user_asset", (q) => q.eq("userId", userId).gte("assetId", "photo:").lt("assetId", "photo;"))
      .collect();
    shots.sort((a, b) => b.takenAt - a.takenAt);
    return await Promise.all(
      shots.slice(0, 50).map(async (shot) => {
        const item = await ctx.db
          .query("items")
          .withIndex("by_screenshot", (q) => q.eq("screenshotId", shot._id))
          .first();
        const thumbUrl = shot.thumbStorageId ? await ctx.storage.getUrl(shot.thumbStorageId) : null;
        return {
          _id: shot._id,
          localAssetId: shot.assetId.startsWith("photo:ph://") || shot.assetId.startsWith("photo:file:") ? null : shot.assetId.slice(6),
          status: shot.status,
          bytes: shot.bytes ?? 0,
          originalDeleted: shot.originalDeleted ?? false,
          thumbUrl,
          item: item ? { _id: item._id, type: item.type, title: item.title, state: item.state } : null,
        };
      }),
    );
  },
});

export const markOriginalDeleted = mutation({
  args: { screenshotId: v.id("screenshots"), bytes: v.optional(v.number()) },
  handler: async (ctx, { screenshotId, bytes }) => {
    const userId = await requireUser(ctx);
    await ownedScreenshot(ctx, userId, screenshotId);
    await ctx.db.patch(screenshotId, { originalDeleted: true, ...(bytes ? { originalBytes: bytes } : {}) });
  },
});

export const retryFailed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const failed = await ctx.db
      .query("screenshots")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "failed"))
      .collect();
    for (const shot of failed) {
      if (!shot.storageId) continue;
      await ctx.db.patch(shot._id, { status: "uploaded", attempts: 0, error: undefined });
      await ctx.scheduler.runAfter(0, internal.ai.processScreenshot.processScreenshot, {
        screenshotId: shot._id,
      });
    }
    return failed.length;
  },
});
