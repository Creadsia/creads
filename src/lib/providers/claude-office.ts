import { GrokError, type Turn } from "./grok";

// Claude (Anthropic Messages API) as the office's brain: the agents' reports and the chat with the owner
// and his partners. Server only. Grok stays for web and X searches (lib/oficina.ts → ask).

export const claudeOfficeConfigured = () => Boolean((process.env.ANTHROPIC_API_KEY ?? "").trim());
// The chat and the leaders (CEO General, directors) think with the same model that builds Creads with the
// owner in the development studio; the daily reports of the rest of the team use a cheaper one.
export const CLAUDE_OFFICE_MODEL = () => (process.env.CLAUDE_OFFICE_MODEL || "claude-sonnet-5-5").trim();
export const CLAUDE_OFFICE_MODEL_CEO = () => (process.env.CLAUDE_OFFICE_MODEL_CEO || "claude-opus-5-5").trim();

/** US$ per million tokens [input, output], by model family (estimates; the office only uses them for its cap). */
function prices(model: string): [number, number] {
  if (/opus/i.test(model)) return [5, 25];
  if (/haiku/i.test(model)) return [1, 5];
  return [3, 15];
}

export async function claudeRun(o: { system: string; prompt: string; history?: Turn[]; model?: string; maxTokens?: number; timeoutMs?: number }): Promise<{ text: string; usd: number; sources: string[]; model: string }> {
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!key) throw new GrokError("falta la clave ANTHROPIC_API_KEY en Vercel.");
  const model = o.model || CLAUDE_OFFICE_MODEL();
  // the API wants turns that alternate and start with the person
  const turns: Turn[] = [];
  for (const t of [...(o.history ?? []), { role: "user" as const, content: o.prompt }]) {
    if (!t.content.trim()) continue;
    if (turns.length && turns[turns.length - 1].role === t.role) turns[turns.length - 1].content += `\n\n${t.content}`;
    else turns.push({ ...t });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: Math.min(16000, Math.max(1000, o.maxTokens ?? 6000)), system: o.system, messages: turns }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 120_000),
    });
  } catch (e) {
    throw new GrokError(e instanceof Error && e.name === "TimeoutError" ? "Claude se demoró demasiado en responder. Prueba de nuevo." : "no se pudo conectar con Claude.");
  }
  const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string }; stop_reason?: string };
  const [pin, pout] = prices(model);
  const usd = ((data.usage?.input_tokens ?? 0) * pin + (data.usage?.output_tokens ?? 0) * pout) / 1e6;
  if (!res.ok) {
    const msg = data.error?.message ?? "";
    if (res.status === 401 || res.status === 403) throw new GrokError("Anthropic rechazó la clave ANTHROPIC_API_KEY: revísala en Vercel.");
    if (/credit balance/i.test(msg)) throw new GrokError("sin saldo en Anthropic: carga créditos en console.anthropic.com → Billing.");
    if (res.status === 429 || res.status === 529) throw new GrokError("Claude está con mucha demanda. Prueba en un par de minutos.");
    if (res.status === 404 || (res.status === 400 && /model/i.test(msg))) throw new GrokError(`el modelo ${model} no está disponible en tu cuenta de Anthropic.`);
    throw new GrokError(`Claude respondió con error (${res.status}).`);
  }
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
  if (data.stop_reason === "max_tokens" && !text) throw new GrokError("la respuesta quedó cortada. Prueba con una pregunta más corta.");
  return { text, usd, sources: [], model };
}
