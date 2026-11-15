import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Not signed in");
  return userId;
}

export async function ownedItem(ctx: QueryCtx | MutationCtx, userId: Id<"users">, itemId: Id<"items">) {
  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) throw new ConvexError("Item not found");
  return item;
}

export async function ownedScreenshot(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  screenshotId: Id<"screenshots">,
) {
  const shot = await ctx.db.get(screenshotId);
  if (!shot || shot.userId !== userId) throw new ConvexError("Screenshot not found");
  return shot;
}

export async function deleteStorage(ctx: MutationCtx, storageId: Id<"_storage"> | undefined) {
  if (!storageId) return;
  const meta = await ctx.db.system.get(storageId);
  if (meta) await ctx.storage.delete(storageId);
}
