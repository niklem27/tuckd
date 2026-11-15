import { z } from "zod";

export const SYSTEM_PROMPT = (today: string, tz: string) =>
  `You analyze a phone screenshot and decide what the user intended to save it for. Return ONLY JSON matching the schema. Today's date is ${today} and the user's timezone is ${tz}; resolve relative dates ("this Friday", "tonight") to ISO 8601. If the screenshot shows banking/financial balances, passwords, 2FA/OTP codes, IDs, medical records, or private intimate conversations, return {"sensitive": true}. Choose the single most useful type. Keep the title ≤ 6 words and the summary ≤ 15 words.

JSON schema:
{
  "sensitive": false,
  "type": "event | place | product | recipe | todo | memory",
  "title": "Jazz Night at Blue Room",
  "summary": "Live jazz trio, free entry before 9pm",
  "startsAt": "2026-11-20T20:00:00-08:00",
  "endsAt": null,
  "deadline": null,
  "location": { "name": "Blue Room", "address": "123 Main St, Palo Alto" },
  "url": null,
  "price": null,
  "confidence": 0.92
}

Type guide: event = something happening at a specific time (flyers, tickets); place = a venue/restaurant to visit; product = something to buy; recipe = food to cook; todo = a task or deadline to act on (job applications, bills, forms); memory = anything kept for fun or reference. The title must name the specific thing (the event, venue, product, dish, or job role), never a generic label like "Job Application Deadline". Use null for unknown fields. price is a string such as "$129". Always include a UTC offset in ISO datetimes.`;

const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((x) => x ?? undefined);

export const extractionSchema = z.union([
  z.object({ sensitive: z.literal(true) }).passthrough(),
  z.object({
    sensitive: z.literal(false).optional(),
    type: z.enum(["event", "place", "product", "recipe", "todo", "memory"]),
    title: z.string().min(1),
    summary: z.string().default(""),
    startsAt: nullish(z.string()),
    endsAt: nullish(z.string()),
    deadline: nullish(z.string()),
    location: nullish(
      z.object({ name: z.string(), address: nullish(z.string()) }),
    ),
    url: nullish(z.string()),
    price: nullish(z.union([z.string(), z.number().transform((n) => `$${n}`)])),
    confidence: z.number().min(0).max(1).default(0.5),
  }),
]);

export type Extraction = z.infer<typeof extractionSchema>;

export type NormalizedResult =
  | { sensitive: true }
  | {
      sensitive: false;
      type: "event" | "place" | "product" | "recipe" | "todo" | "memory";
      title: string;
      summary: string;
      startsAt?: number;
      endsAt?: number;
      remindAt?: number;
      location?: { name: string; address?: string };
      url?: string;
      price?: string;
      confidence: number;
    };

const toMs = (iso?: string) => {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
};

const DAY = 24 * 60 * 60 * 1000;

export function parseModelText(text: string): NormalizedResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model returned no JSON");
  const parsed = extractionSchema.parse(JSON.parse(text.slice(start, end + 1)));
  if (parsed.sensitive === true) return { sensitive: true };
  const type = parsed.confidence < 0.4 ? "memory" : parsed.type;
  const deadline = toMs(parsed.deadline);
  const startsAt = toMs(parsed.startsAt) ?? (type === "todo" ? deadline : undefined);
  const location = parsed.location?.name ? parsed.location : undefined;
  return {
    sensitive: false,
    type,
    title: parsed.title.trim(),
    summary: parsed.summary.trim(),
    startsAt,
    endsAt: toMs(parsed.endsAt),
    remindAt: type === "todo" && deadline ? deadline - DAY : undefined,
    location,
    url: parsed.url ?? undefined,
    price: parsed.price ?? undefined,
    confidence: parsed.confidence,
  };
}

export function todayIn(tz: string, now = Date.now()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  return `${fmt.format(now)} (${iso})`;
}
