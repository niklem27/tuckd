import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, MutationCtx } from "./_generated/server";
import { requireUser } from "./lib";

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TZ = "America/Los_Angeles";

export const linkCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not ready");
    if (profile.linkCode) return profile.linkCode;
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    await ctx.db.patch(profile._id, { linkCode: code });
    return code;
  },
});

async function userForSender(ctx: MutationCtx, sender: string): Promise<Id<"users">> {
  const link = await ctx.db
    .query("agentLinks")
    .withIndex("by_sender", (q) => q.eq("sender", sender))
    .unique();
  if (link) return link.userId;
  const userId = await ctx.db.insert("users", { isAnonymous: true });
  await ctx.db.insert("profiles", { userId, timezone: DEFAULT_TZ, briefEnabled: true, onboarded: true });
  await ctx.db.insert("agentLinks", { sender, userId });
  return userId;
}

export const link = internalMutation({
  args: { sender: v.string(), code: v.string() },
  handler: async (ctx, { sender, code }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_link_code", (q) => q.eq("linkCode", code))
      .unique();
    if (!profile) return { linked: false as const };
    const existing = await ctx.db
      .query("agentLinks")
      .withIndex("by_sender", (q) => q.eq("sender", sender))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { userId: profile.userId });
    else await ctx.db.insert("agentLinks", { sender, userId: profile.userId });
    return { linked: true as const };
  },
});

export const ingest = internalMutation({
  args: { sender: v.string(), assetId: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { sender, assetId, storageId }) => {
    const userId = await userForSender(ctx, sender);
    const existing = await ctx.db
      .query("screenshots")
      .withIndex("by_user_asset", (q) => q.eq("userId", userId).eq("assetId", assetId))
      .unique();
    if (existing) {
      await ctx.storage.delete(storageId);
      return existing._id;
    }
    const meta = await ctx.db.system.get(storageId);
    const screenshotId = await ctx.db.insert("screenshots", {
      userId,
      assetId,
      takenAt: Date.now(),
      storageId,
      status: "uploaded",
      attempts: 0,
      bytes: meta?.size,
    });
    await ctx.scheduler.runAfter(0, internal.ai.processScreenshot.processScreenshot, { screenshotId });
    return screenshotId;
  },
});

export const result = internalQuery({
  args: { screenshotId: v.id("screenshots") },
  handler: async (ctx, { screenshotId }) => {
    const shot = await ctx.db.get(screenshotId);
    if (!shot) return null;
    const item = await ctx.db
      .query("items")
      .withIndex("by_screenshot", (q) => q.eq("screenshotId", screenshotId))
      .first();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", shot.userId))
      .unique();
    return { status: shot.status, item, timezone: profile?.timezone ?? DEFAULT_TZ };
  },
});

export const keepItem = internalMutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (item?.state === "inbox") await ctx.db.patch(itemId, { state: "kept", triagedAt: Date.now() });
  },
});

function dayBounds(tz: string, now: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  const asUtc = Date.UTC(y, m - 1, d, Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offset = Math.round((asUtc - now) / 60000) * 60000;
  const start = Date.UTC(y, m - 1, d) - offset;
  return { start, end: start + DAY };
}

export const briefItems = internalQuery({
  args: { sender: v.string(), now: v.number() },
  handler: async (ctx, { sender, now }) => {
    const link = await ctx.db
      .query("agentLinks")
      .withIndex("by_sender", (q) => q.eq("sender", sender))
      .unique();
    if (!link) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", link.userId))
      .unique();
    const timezone = profile?.timezone ?? DEFAULT_TZ;
    const { start, end } = dayBounds(timezone, now);
    const starting = await ctx.db
      .query("items")
      .withIndex("by_user_starts", (q) => q.eq("userId", link.userId).gte("startsAt", start).lt("startsAt", end))
      .collect();
    const due: Doc<"items">[] = [];
    for (const state of ["inbox", "kept"] as const) {
      const rows = await ctx.db
        .query("items")
        .withIndex("by_user_state", (q) => q.eq("userId", link.userId).eq("state", state))
        .filter((q) => q.and(q.gte(q.field("remindAt"), start), q.lt(q.field("remindAt"), end)))
        .collect();
      due.push(...rows);
    }
    const byId = new Map([...starting, ...due].filter((i) => i.state !== "archived").map((i) => [i._id, i]));
    const when = (i: Doc<"items">) => (i.startsAt && i.startsAt >= start && i.startsAt < end ? i.startsAt : (i.remindAt ?? 0));
    const items = [...byId.values()].sort((a, b) => when(a) - when(b));
    return { timezone, items: items.map((i) => ({ title: i.title, type: i.type, at: when(i), place: i.location?.name })) };
  },
});
