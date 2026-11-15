import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NormalizedResult } from "../convex/ai/extraction";
import { extractFromImage, MODEL } from "../convex/ai/model";

config({ path: ".env.local" });

type Expected = {
  file: string;
  autoScan?: boolean;
  reason?: "sensitive" | "irrelevant";
  sensitive: boolean;
  type?: string;
  titleIncludes?: string[];
  startsAtLocal?: { day?: "today"; date?: string; hour: number };
  deadlineLocalDate?: string;
  locationIncludes?: string;
  priceIncludes?: string;
};

const TZ = process.env.EVAL_TZ ?? "America/Los_Angeles";
const dir = join(__dirname, "../convex/ai/fixtures");
const localDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms);
const localHour = (ms: number) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(ms));

function check(exp: Expected, got: NormalizedResult): string[] {
  const problems: string[] = [];
  if (got.sensitive !== exp.sensitive) return [`sensitive=${got.sensitive}, expected ${exp.sensitive}`];
  if (got.sensitive) return exp.reason && got.reason !== exp.reason ? [`reason=${got.reason}, expected ${exp.reason}`] : problems;
  if (exp.type && got.type !== exp.type) problems.push(`type=${got.type}, expected ${exp.type}`);
  if (exp.titleIncludes && !exp.titleIncludes.some((w) => got.title.toLowerCase().includes(w)))
    problems.push(`title "${got.title}" missing any of ${exp.titleIncludes.join("/")}`);
  if (got.title.split(/\s+/).length > 6) problems.push(`title longer than 6 words`);
  if (exp.startsAtLocal) {
    if (!got.startsAt) problems.push("no startsAt");
    else {
      const wantDate = exp.startsAtLocal.day === "today" ? localDate(Date.now()) : exp.startsAtLocal.date;
      if (localDate(got.startsAt) !== wantDate) problems.push(`startsAt date ${localDate(got.startsAt)}, expected ${wantDate}`);
      if (localHour(got.startsAt) !== exp.startsAtLocal.hour)
        problems.push(`startsAt hour ${localHour(got.startsAt)}, expected ${exp.startsAtLocal.hour}`);
    }
  }
  if (exp.deadlineLocalDate) {
    const due = got.startsAt;
    if (!due || localDate(due) !== exp.deadlineLocalDate)
      problems.push(`deadline ${due ? localDate(due) : "missing"}, expected ${exp.deadlineLocalDate}`);
    if (!got.remindAt) problems.push("no remindAt");
  }
  if (exp.locationIncludes && !got.location?.name.toLowerCase().includes(exp.locationIncludes))
    problems.push(`location "${got.location?.name ?? ""}" missing "${exp.locationIncludes}"`);
  if (exp.priceIncludes && !got.price?.includes(exp.priceIncludes))
    problems.push(`price "${got.price ?? ""}" missing "${exp.priceIncludes}"`);
  return problems;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Set OPENAI_API_KEY in your shell or .env.local to run the eval.");
    process.exit(2);
  }
  console.log(`Model: ${MODEL}, timezone: ${TZ}\n`);
  const expected: Expected[] = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
  const results = await Promise.all(
    expected.map(async (exp) => {
      try {
        const data = readFileSync(join(dir, exp.file)).toString("base64");
        const mime = exp.file.endsWith(".jpg") ? "image/jpeg" : "image/png";
        const got = await extractFromImage(apiKey, data, mime, TZ, exp.autoScan);
        return { exp, got, problems: check(exp, got) };
      } catch (err) {
        return { exp, got: null, problems: [err instanceof Error ? err.message : String(err)] };
      }
    }),
  );
  let passed = 0;
  for (const { exp, got, problems } of results) {
    const ok = problems.length === 0;
    if (ok) passed++;
    const summary = got ? (got.sensitive ? got.reason : `${got.type}: ${got.title}`) : "error";
    console.log(`${ok ? "PASS" : "FAIL"}  ${exp.file.padEnd(24)} ${summary}`);
    for (const p of problems) console.log(`      - ${p}`);
  }
  console.log(`\n${passed}/${results.length} fixtures passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
