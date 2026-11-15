import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireUser } from "./lib";

const DAY = 24 * 60 * 60 * 1000;

export const savePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .collect();
    for (const row of existing) if (row.userId !== userId) await ctx.db.delete(row._id);
    if (!existing.some((row) => row.userId === userId)) {
      await ctx.db.insert("pushTokens", { userId, token });
    }
  },
});

function localParts(tz: string, now: number) {
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
  const dayStart = Date.UTC(y, m - 1, d) - offset;
  return { hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}`, dayStart, dayEnd: dayStart + DAY };
}

export const briefTargets = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const profiles = await ctx.db.query("profiles").collect();
    const targets = [];
    for (const profile of profiles) {
      if (!profile.briefEnabled) continue;
      let local;
      try {
        local = localParts(profile.timezone, now);
      } catch {
        continue;
      }
      if (local.hour !== 7 || profile.lastBriefDate === local.date) continue;
      const items = await ctx.db
        .query("items")
        .withIndex("by_user_starts", (q) =>
          q.eq("userId", profile.userId).gte("startsAt", local.dayStart).lt("startsAt", local.dayEnd),
        )
        .collect();
      const todos = await ctx.db
        .query("items")
        .withIndex("by_user_state", (q) => q.eq("userId", profile.userId).eq("state", "kept"))
        .filter((q) => q.and(q.gte(q.field("remindAt"), local.dayStart), q.lt(q.field("remindAt"), local.dayEnd)))
        .collect();
      const relevant = new Map(
        [...items, ...todos].filter((i) => i.state !== "archived").map((i) => [i._id, i]),
      );
      if (relevant.size === 0) continue;
      const tokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .collect();
      if (tokens.length === 0) continue;
      targets.push({
        profileId: profile._id,
        date: local.date,
        count: relevant.size,
        firstTitle: [...relevant.values()][0].title,
        tokens: tokens.map((t) => t.token),
      });
    }
    return targets;
  },
});

export const markBriefSent = internalMutation({
  args: { profileId: v.id("profiles"), date: v.string() },
  handler: async (ctx, { profileId, date }) => {
    await ctx.db.patch(profileId, { lastBriefDate: date });
  },
});

export const sendMorningBriefs = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const targets = await ctx.runQuery(internal.notifications.briefTargets, { now: Date.now() });
    for (const target of targets) {
      const noun = target.count === 1 ? "thing" : "things";
      const messages = target.tokens.map((to) => ({
        to,
        sound: "default",
        title: "Good morning",
        body: `${target.count} ${noun} you saved matter today, starting with ${target.firstTitle}.`,
        data: { url: "snapback://today" },
      }));
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.error("Expo push failed", res.status, await res.text());
        continue;
      }
      await ctx.runMutation(internal.notifications.markBriefSent, {
        profileId: target.profileId,
        date: target.date,
      });
    }
    return targets.length;
  },
});
