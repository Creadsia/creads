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
        max_tokens: 8000,
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
    const text: string = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    const stop: string = data?.stop_reason ?? "";
    if (stop === "refusal") throw new Error("Claude no quiso procesar este texto (filtro de seguridad).");
    if (stop === "max_tokens") throw new Error("La respuesta de Claude quedó cortada (texto demasiado largo).");
    if (json && !text.includes("{")) {
      console.error("claude no-json", stop, text.slice(0, 300));
      throw new Error(`Claude respondió sin el formato esperado: “${text.trim().slice(0, 160)}”`);
    }
    return text;
  },
};

/** Pulls the first JSON object or array out of a model answer (tolerates stray text or code fences). */
export function parseJSON<T>(text: string): T {
  const o = text.indexOf("{"), a = text.indexOf("[");
  const isArray = a >= 0 && (o < 0 || a < o);
  const start = isArray ? a : o;
  const end = text.lastIndexOf(isArray ? "]" : "}");
  if (start < 0 || end < start) throw new Error("La IA no devolvió JSON.");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error("La respuesta de la IA vino incompleta. Intenta de nuevo.");
  }
}
