// Grok (xAI) for the owner's agent office (Panel → Oficina). Server-only, never used for customers.
// Responses API (https://api.x.ai/v1/responses); with `search` the model may look things up on the web
// and on X by itself (web_search / x_search tools, billed per use). The key lives in XAI_API_KEY.

export const grokConfigured = () => Boolean((process.env.XAI_API_KEY ?? "").trim());

/** US$ per 1M tokens [input, cached input, output] (docs.x.ai/developers/pricing, Oct 2026). */
const PRICES: Record<string, [number, number, number]> = {
  "grok-4.7": [2, 0.5, 6],
  "grok-4.6": [2, 0.5, 6],
  "grok-4.5": [2, 0.3, 6],
  "grok-4.3": [1.25, 0.2, 2.5],
};
const SEARCH_USD = 0.005; // per web search call / per X post returned

export const GROK_MODEL = () => (process.env.XAI_MODEL || "grok-4.3").trim();
export const GROK_MODEL_CEO = () => (process.env.XAI_MODEL_CEO || "grok-4.7").trim();

export interface GrokResult { text: string; usd: number; sources: string[]; model: string }
export interface Turn { role: "user" | "assistant"; content: string }

/** A failed answer that may still have cost money (the cost travels with the error). */
export class GrokError extends Error {
  constructor(message: string, public usd = 0) { super(message); }
}

interface RespItem { type?: string; content?: { type?: string; text?: string; annotations?: { type?: string; url?: string }[] }[] }
export interface Resp {
  status?: string;
  output_text?: string;
  output?: RespItem[];
  citations?: (string | { url?: string })[];
  usage?: {
    input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number }; cost_in_usd_ticks?: number; num_sources_used?: number;
    server_side_tool_usage?: Record<string, number>;
  };
  incomplete_details?: { reason?: string };
  error?: { message?: string } | string;
}

/**
 * What one answer cost: the API's own figure when it gives one; otherwise tokens × price + searches.
 * Reasoning tokens are added on top of output tokens: if the API already counts them inside, this
 * overestimates, which is the safe side for a budget.
 */
export function costOf(model: string, r: Resp): number {
  const u = r.usage ?? {};
  if (typeof u.cost_in_usd_ticks === "number" && u.cost_in_usd_ticks > 0) return u.cost_in_usd_ticks / 1e10;
  const [inp, cached, out] = PRICES[model] ?? PRICES["grok-4.7"];
  const cachedT = Math.min(u.input_tokens ?? 0, u.input_tokens_details?.cached_tokens ?? 0);
  const outT = (u.output_tokens ?? 0) + (u.output_tokens_details?.reasoning_tokens ?? 0);
  const tokens = ((u.input_tokens ?? 0) - cachedT) * inp + cachedT * cached + outT * out;
  const calls = Object.values(u.server_side_tool_usage ?? {}).reduce((a, n) => a + (Number(n) || 0), 0)
    || (r.output ?? []).filter((o) => /search_call$/.test(o.type ?? "")).length;
  return tokens / 1e6 + Math.max(calls, u.num_sources_used ?? 0) * SEARCH_USD;
}

/** The answer's text and the links it cited. */
export function readResp(r: Resp) {
  const parts = (r.output ?? []).flatMap((it) => (it.type === "message" ? it.content ?? [] : []));
  const text = (r.output_text ?? parts.filter((c) => c.type === "output_text" || c.text).map((c) => c.text ?? "").join("\n")).trim();
  const urls = new Set<string>();
  for (const c of r.citations ?? []) { const u = typeof c === "string" ? c : c?.url; if (u) urls.add(u); }
  for (const c of parts) for (const a of c.annotations ?? []) if (a.url) urls.add(a.url);
  return { text, sources: [...urls].filter((u) => /^https?:\/\//.test(u)).slice(0, 20) };
}

export async function grokRun(o: { system: string; prompt: string; history?: Turn[]; search?: boolean; model?: string; maxTokens?: number; timeoutMs?: number }): Promise<GrokResult> {
  const key = (process.env.XAI_API_KEY ?? "").trim();
  if (!key) throw new GrokError("falta la clave XAI_API_KEY en Vercel.");
  const model = o.model || GROK_MODEL();
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "system", content: o.system }, ...(o.history ?? []), { role: "user", content: o.prompt }],
        max_output_tokens: o.maxTokens ?? 6000,
        store: false,
        ...(o.search ? { tools: [{ type: "web_search" }, { type: "x_search" }] } : {}),
      }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 120_000),
    });
  } catch (e) {
    throw new GrokError(e instanceof Error && e.name === "TimeoutError" ? "Grok se demoró demasiado en responder. Prueba de nuevo." : "no se pudo conectar con xAI.");
  }
  const data = (await res.json().catch(() => ({}))) as Resp;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    if (res.status === 401 || res.status === 403) throw new GrokError("xAI rechazó la clave: revisa XAI_API_KEY en Vercel.");
    if (res.status === 402 || /credit|balance|billing|spend/i.test(msg ?? "")) throw new GrokError("sin saldo en xAI: carga créditos en console.x.ai → Billing.");
    if (res.status === 429) throw new GrokError("xAI pidió esperar (demasiadas solicitudes). Prueba en unos minutos.");
    throw new GrokError(`xAI respondió ${res.status}${msg ? `: ${String(msg).slice(0, 200)}` : ""}`);
  }
  const usd = costOf(model, data);
  const { text, sources } = readResp(data);
  if (data.status && data.status !== "completed") throw new GrokError(data.incomplete_details?.reason === "max_output_tokens" ? "la respuesta quedó cortada (se le acabó el largo máximo)." : `la respuesta no terminó (${data.status}).`, usd);
  if (!text) throw new GrokError("Grok devolvió una respuesta vacía.", usd);
  return { text, usd, sources, model };
}
