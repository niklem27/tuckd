import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

export const itemLocation = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => (await ctx.db.get(itemId))?.location ?? null,
});

export const setCoords = internalMutation({
  args: { itemId: v.id("items"), lat: v.number(), lng: v.number() },
  handler: async (ctx, { itemId, lat, lng }) => {
    const item = await ctx.db.get(itemId);
    if (!item?.location) return;
    await ctx.db.patch(itemId, { location: { ...item.location, lat, lng } });
  },
});

export const geocodeItem = internalAction({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }): Promise<void> => {
    const location = await ctx.runQuery(internal.ai.geocode.itemLocation, { itemId });
    if (!location?.address) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location.address)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Snapback/1.0 (hackathon demo)" } });
    if (!res.ok) return;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return;
    await ctx.runMutation(internal.ai.geocode.setCoords, { itemId, lat: Number(hit.lat), lng: Number(hit.lon) });
  },
});
