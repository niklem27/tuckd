import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { deleteStorage, ownedItem, requireUser } from "./lib";
import { itemType } from "./schema";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const IMAGE_GRACE_MS = 15_000;

async function withThumb(ctx: QueryCtx, item: Doc<"items">) {
  const shot = await ctx.db.get(item.screenshotId);
  const thumbUrl = shot?.thumbStorageId
    ? await ctx.storage.getUrl(shot.thumbStorageId)
    : shot?.storageId
      ? await ctx.storage.getUrl(shot.storageId)
      : null;
  return { ...item, thumbUrl, takenAt: shot?.takenAt ?? item.createdAt };
}

async function currentUser(ctx: QueryCtx) {
  return await requireUser(ctx).catch(() => null);
}

export const inbox = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUser(ctx);
    if (!userId) return [];
    const items = await ctx.db
      .query("items")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "inbox"))
      .order("desc")
      .take(100);
    const withThumbs = await Promise.all(items.map((item) => withThumb(ctx, item)));
    return withThumbs.sort((a, b) => b.takenAt - a.takenAt);
  },
});

async function timedItems(ctx: QueryCtx, userId: Id<"users">, from: number, to: number) {
  const byStart = await ctx.db
    .query("items")
    .withIndex("by_user_starts", (q) => q.eq("userId", userId).gte("startsAt", from).lt("startsAt", to))
    .collect();
  const seen = new Set(byStart.map((i) => i._id));
  const reminders: Doc<"items">[] = [];
  for (const state of ["inbox", "kept"] as const) {
    const rows = await ctx.db
      .query("items")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", state))
      .filter((q) =>
        q.and(q.eq(q.field("type"), "todo"), q.gte(q.field("remindAt"), from), q.lt(q.field("remindAt"), to)),
      )
      .collect();
    for (const row of rows) if (!seen.has(row._id)) reminders.push(row);
  }
  const all = [...byStart, ...reminders].filter(
    (i) => i.state !== "archived" && (i.type === "event" || i.type === "todo"),
  );
  const when = (i: Doc<"items">) =>
    i.startsAt !== undefined && i.startsAt >= from && i.startsAt < to ? i.startsAt : (i.remindAt ?? 0);
  all.sort((a, b) => when(a) - when(b));
  return await Promise.all(all.map((item) => withThumb(ctx, item)));
}

export const today = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const userId = await currentUser(ctx);
    if (!userId) return [];
    return await timedItems(ctx, userId, from, to);
  },
});

export const upcoming = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const userId = await currentUser(ctx);
    if (!userId) return [];
    return await timedItems(ctx, userId, from, to);
  },
});

export const saved = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUser(ctx);
    if (!userId) return [];
    const kept = await ctx.db
      .query("items")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "kept"))
      .order("desc")
      .collect();
    const done = await ctx.db
      .query("items")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "done"))
      .order("desc")
      .collect();
    const all = [...kept, ...done].sort((a, b) => (b.triagedAt ?? b.createdAt) - (a.triagedAt ?? a.createdAt));
    return await Promise.all(all.map((item) => withThumb(ctx, item)));
  },
});

export const keptPlaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUser(ctx);
    if (!userId) return [];
    const kept = await ctx.db
      .query("items")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "kept"))
      .filter((q) => q.eq(q.field("type"), "place"))
      .collect();
    return kept.map(({ _id, title, location, createdAt }) => ({ _id, title, location, createdAt }));
  },
});

export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const userId = await currentUser(ctx);
    if (!userId || !q.trim()) return [];
    const rows = await ctx.db
      .query("items")
      .withSearchIndex("search_title", (s) => s.search("searchText", q).eq("userId", userId))
      .take(40);
    const visible = rows.filter((r) => r.state === "kept" || r.state === "done").slice(0, 20);
    return await Promise.all(visible.map((item) => withThumb(ctx, item)));
  },
});

export const get = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const userId = await currentUser(ctx);
    if (!userId) return null;
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) return null;
    const shot = await ctx.db.get(item.screenshotId);
    const imageUrl = shot?.storageId ? await ctx.storage.getUrl(shot.storageId) : null;
    return { ...(await withThumb(ctx, item)), imageUrl };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUser(ctx);
    if (!userId) return null;
    const weekAgo = Date.now() - WEEK;
    let clearedThisWeek = 0;
    const counts = { inbox: 0, kept: 0, archived: 0, done: 0 };
    for (const state of ["inbox", "kept", "archived", "done"] as const) {
      const rows = await ctx.db
        .query("items")
        .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", state))
        .collect();
      counts[state] = rows.length;
      if (state !== "inbox") clearedThisWeek += rows.filter((r) => (r.triagedAt ?? 0) >= weekAgo).length;
    }
    const done = await ctx.db
      .query("screenshots")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "done"))
      .collect();
    const skipped = await ctx.db
      .query("screenshots")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "skipped"))
      .collect();
    return {
      ...counts,
      clearedThisWeek,
      sorted: done.length + skipped.length,
      skipped: skipped.length,
      estimatedFreeableBytes: (done.length + skipped.length) * 1_500_000,
    };
  },
});

async function setState(
  ctx: MutationCtx,
  itemId: Id<"items">,
  state: Doc<"items">["state"],
) {
  const userId = await requireUser(ctx);
  const item = await ownedItem(ctx, userId, itemId);
  await ctx.db.patch(itemId, { state, triagedAt: state === "inbox" ? undefined : Date.now() });
  if (state === "archived" || state === "done") {
    await ctx.scheduler.runAfter(IMAGE_GRACE_MS, internal.items.releaseImage, { itemId });
  }
  return item;
}

export const keep = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    await setState(ctx, itemId, "kept");
  },
});

export const archive = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    await setState(ctx, itemId, "archived");
  },
});

export const markDone = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    await setState(ctx, itemId, "done");
  },
});

export const undo = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    await setState(ctx, itemId, "inbox");
  },
});

export const update = mutation({
  args: {
    itemId: v.id("items"),
    title: v.optional(v.string()),
    type: v.optional(itemType),
    startsAt: v.optional(v.union(v.number(), v.null())),
    remindAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { itemId, title, type, startsAt, remindAt }) => {
    const userId = await requireUser(ctx);
    const item = await ownedItem(ctx, userId, itemId);
    const nextTitle = title?.trim() || item.title;
    await ctx.db.patch(itemId, {
      title: nextTitle,
      type: type ?? item.type,
      searchText: `${nextTitle} ${item.summary}`,
      ...(startsAt !== undefined ? { startsAt: startsAt ?? undefined } : {}),
      ...(remindAt !== undefined ? { remindAt: remindAt ?? undefined } : {}),
    });
  },
});

export const releaseImage = internalMutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item || (item.state !== "archived" && item.state !== "done")) return;
    const shot = await ctx.db.get(item.screenshotId);
    if (!shot?.storageId) return;
    await deleteStorage(ctx, shot.storageId);
    await ctx.db.patch(shot._id, { storageId: undefined });
  },
});
