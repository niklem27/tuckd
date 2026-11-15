import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function authorized(req: Request) {
  const secret = process.env.SNAPBACK_AGENT_SECRET;
  if (!secret) return false;
  return req.headers.get("Authorization") === `Bearer ${secret}` || new URL(req.url).searchParams.get("key") === secret;
}

type ToolCall = {
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  context?: { userId?: string; phone?: string; attachments?: { url?: string; mime_type?: string }[] };
} & Record<string, unknown>;

async function readToolCall(req: Request) {
  const body = (await req.json()) as ToolCall;
  const input = (body.input ?? body.args ?? body.arguments ?? body) as Record<string, unknown>;
  const context = body.context ?? {};
  const attachment = context.attachments?.find((a) => a.url);
  const sender =
    (input.sender as string | undefined) ??
    context.userId ??
    context.phone ??
    req.headers.get("X-Orchid-User-Id") ??
    undefined;
  console.log("agent tool call", JSON.stringify({ keys: Object.keys(body), inputKeys: Object.keys(input), contextKeys: Object.keys(context), hasAttachment: !!attachment, hasSender: !!sender }));
  return {
    sender,
    imageUrl: (input.image_url as string | undefined) ?? (input.imageUrl as string | undefined) ?? attachment?.url,
    imageBase64: input.imageBase64 as string | undefined,
    mimeType: (input.mimeType as string | undefined) ?? attachment?.mime_type,
    code: (input.code as string | undefined) ?? (input.link_code as string | undefined),
  };
}

const fmtWhen = (ms: number, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" }).format(ms);
const fmtTime = (ms: number, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(ms);

const VERB: Record<string, string> = {
  event: "Added",
  place: "Saved",
  product: "Saved",
  recipe: "Saved recipe",
  todo: "Reminder set for",
  memory: "Tucked",
};

http.route({
  path: "/agent/screenshot",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await readToolCall(req);
    if (!body.sender || (!body.imageUrl && !body.imageBase64)) {
      return json({ error: "sender and imageUrl or imageBase64 are required" }, 400);
    }
    let bytes: Uint8Array<ArrayBuffer>;
    let mimeType = body.mimeType ?? "image/jpeg";
    if (body.imageBase64) {
      bytes = Uint8Array.from(atob(body.imageBase64.replace(/^data:[^,]+,/, "")), (c) => c.charCodeAt(0));
    } else {
      const res = await fetch(body.imageUrl!);
      if (!res.ok) return json({ error: `could not download image (${res.status})` }, 400);
      mimeType = res.headers.get("Content-Type")?.split(";")[0] ?? mimeType;
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const assetId = `agent:${[...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const storageId: Id<"_storage"> = await ctx.storage.store(new Blob([bytes], { type: mimeType }));
    const screenshotId = await ctx.runMutation(internal.agent.ingest, { sender: body.sender, assetId, storageId });

    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const r = await ctx.runQuery(internal.agent.result, { screenshotId });
      if (r?.status === "skipped") {
        return json({ status: "skipped", reply: "That looks private (banking, a password or an ID), so I skipped it and deleted the image." });
      }
      if (r?.status === "failed") return json({ status: "failed", reply: "I couldn't read that screenshot. Try sending it again." });
      if (r?.status === "done" && r.item) {
        await ctx.runMutation(internal.agent.keepItem, { itemId: r.item._id });
        const item = r.item;
        const when = item.startsAt ? `, ${fmtWhen(item.startsAt, r.timezone)}` : "";
        const where = item.location?.name && item.type !== "event" ? ` (${item.location.name})` : "";
        const reply = `${VERB[item.type]} ${item.title}${when}${where} ✓`;
        return json({
          status: "done",
          reply,
          item: {
            type: item.type,
            title: item.title,
            summary: item.summary,
            startsAt: item.startsAt ? new Date(item.startsAt).toISOString() : null,
            location: item.location ?? null,
            url: item.url ?? null,
            price: item.price ?? null,
          },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return json({ status: "processing", reply: "Still sorting that one. It will show up in your Tuckd inbox shortly." });
  }),
});

http.route({
  path: "/agent/brief",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const { sender } = await readToolCall(req);
    if (!sender) return json({ error: "sender is required" }, 400);
    const brief = await ctx.runQuery(internal.agent.briefItems, { sender, now: Date.now() });
    if (!brief) return json({ count: 0, text: "Send me a screenshot first and I'll start tucking them away." });
    const { items, timezone } = brief;
    if (items.length === 0) return json({ count: 0, text: "Good morning! Nothing you saved is due today." });
    const lines = items.map((i) => `• ${fmtTime(i.at, timezone)} ${i.title}${i.place && !i.title.includes(i.place) && i.place !== i.title ? ` @ ${i.place}` : ""}`);
    const noun = items.length === 1 ? "thing" : "things";
    return json({
      count: items.length,
      text: `Good morning! ${items.length} ${noun} you saved matter today:\n${lines.join("\n")}`,
    });
  }),
});

http.route({
  path: "/agent/link",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const { sender, code } = await readToolCall(req);
    if (!sender || !code) return json({ error: "sender and code are required" }, 400);
    const r = await ctx.runMutation(internal.agent.link, { sender, code: code.trim() });
    return json(
      r.linked
        ? { linked: true, reply: "Linked! Screenshots you text me now land in your Tuckd app." }
        : { linked: false, reply: "That link code didn't match. Open Tuckd › Settings › Text Tuckd to get a fresh link." },
    );
  }),
});

export default http;
