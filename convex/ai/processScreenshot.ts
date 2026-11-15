"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { SYSTEM_PROMPT, parseModelText, todayIn } from "./extraction";
import { MODEL } from "./model";
const MAX_ATTEMPTS = 3;

export const processScreenshot = internalAction({
  args: { screenshotId: v.id("screenshots") },
  handler: async (ctx, { screenshotId }): Promise<void> => {
    const job = await ctx.runMutation(internal.ai.results.startProcessing, { screenshotId });
    if (!job) return;
    try {
      const blob = await ctx.storage.get(job.storageId);
      if (!blob) throw new Error("Image missing from storage");
      const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
      const mediaType = blob.type === "image/png" ? "image/png" : "image/jpeg";
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment");
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT(todayIn(job.timezone), job.timezone),
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: "Analyze this screenshot and return the JSON." },
            ],
          },
        ],
      });
      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const result = parseModelText(text);
      await ctx.runMutation(internal.ai.results.saveResult, { screenshotId, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("processScreenshot failed", screenshotId, message);
      const retry = job.attempts < MAX_ATTEMPTS;
      await ctx.runMutation(internal.ai.results.markFailed, {
        screenshotId,
        error: message.slice(0, 500),
        retry,
      });
      if (retry) {
        await ctx.scheduler.runAfter(2000 * 2 ** (job.attempts - 1), internal.ai.processScreenshot.processScreenshot, {
          screenshotId,
        });
      }
    }
  },
});
