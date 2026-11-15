import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const itemType = v.union(
  v.literal("event"),
  v.literal("place"),
  v.literal("product"),
  v.literal("recipe"),
  v.literal("todo"),
  v.literal("memory"),
);

export const itemState = v.union(
  v.literal("inbox"),
  v.literal("kept"),
  v.literal("archived"),
  v.literal("done"),
);

export const screenshotStatus = v.union(
  v.literal("pending"),
  v.literal("uploaded"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("skipped"),
  v.literal("failed"),
);

export const location = v.object({
  name: v.string(),
  address: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
});

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    timezone: v.string(),
    lastSyncedAt: v.optional(v.number()),
    briefEnabled: v.boolean(),
    onboarded: v.optional(v.boolean()),
    lastBriefDate: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  screenshots: defineTable({
    userId: v.id("users"),
    assetId: v.string(),
    takenAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    thumbStorageId: v.optional(v.id("_storage")),
    status: screenshotStatus,
    attempts: v.number(),
    error: v.optional(v.string()),
    bytes: v.optional(v.number()),
  })
    .index("by_user_asset", ["userId", "assetId"])
    .index("by_user_status", ["userId", "status"]),

  items: defineTable({
    userId: v.id("users"),
    screenshotId: v.id("screenshots"),
    type: itemType,
    title: v.string(),
    summary: v.string(),
    searchText: v.string(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    remindAt: v.optional(v.number()),
    location: v.optional(location),
    url: v.optional(v.string()),
    price: v.optional(v.string()),
    confidence: v.number(),
    state: itemState,
    createdAt: v.number(),
    triagedAt: v.optional(v.number()),
  })
    .index("by_user_state", ["userId", "state", "createdAt"])
    .index("by_user_starts", ["userId", "startsAt"])
    .index("by_screenshot", ["screenshotId"])
    .searchIndex("search_title", {
      searchField: "searchText",
      filterFields: ["userId", "state"],
    }),

  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),
});
