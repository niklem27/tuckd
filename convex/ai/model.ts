import OpenAI from "openai";
import { NormalizedResult, parseModelText, SYSTEM_PROMPT, todayIn } from "./extraction";

export const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-6.1-terra";

export async function extractFromImage(
  apiKey: string,
  base64: string,
  mediaType: string,
  timezone: string,
): Promise<NormalizedResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT(todayIn(timezone), timezone) },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: "text", text: "Analyze this screenshot and return the JSON." },
        ],
      },
    ],
  });
  return parseModelText(response.choices[0]?.message?.content ?? "");
}
