import type { TextAI } from "./types";

// Claude through the Anthropic Messages API, called only from the server.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } };

export const claude: TextAI = {
  id: "claude",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async complete({ system, prompt, images, json }) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Falta ANTHROPIC_API_KEY en Vercel.");

    const content: Block[] = [
      ...(images ?? []).map((url): Block => ({ type: "image", source: { type: "url", url } })),
      { type: "text", text: json ? `${prompt}\n\nRespond with JSON only, no text before or after.` : prompt },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content }],
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      console.error("claude error", res.status, msg);
      throw new Error(`Claude respondió con error (${res.status}).`);
    }
    return (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
  },
};

/** Pulls the first JSON object out of a model answer (tolerates stray text or code fences). */
export function parseJSON<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("La IA no devolvió JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
