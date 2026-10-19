import { API_FORMATS } from "./api-ads";

// The Creads connector (MCP, «Streamable HTTP» without sessions): Claude, ChatGPT or any MCP client calls
// these tools with an API key of the user's account (from OAuth or «API para sistemas»). Each tool goes
// through the same public endpoints as any system, so credits, limits and quality checks are the same.

export const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
type Json = Record<string, unknown>;
export type Call = <T>(path: string, body?: unknown) => Promise<T>;

interface Tool {
  name: string; title: string; description: string;
  inputSchema: Json;
  annotations: { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  run: (args: Json, call: Call, origin: string) => Promise<{ text: string; data?: Json }>;
}

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const abs = (origin: string, u: string) => (u.startsWith("http") ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`);

export const TOOLS: Tool[] = [
  {
    name: "creads_saldo", title: "Ver créditos",
    description: "Shows how many Creads credits the user's account has left (credits pay for images and videos).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "Ver créditos", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (_a, call) => {
      const d = await call<{ unlimited?: boolean; balance?: number | null; plan?: string | null }>("/api/credits");
      if (d.unlimited) return { text: "La cuenta no tiene límite de créditos.", data: { ilimitado: true } };
      return { text: `La cuenta tiene ${d.balance ?? 0} créditos${d.plan ? ` (plan ${d.plan})` : ""}.`, data: { creditos: d.balance ?? 0, plan: d.plan ?? null } };
    },
  },
  {
    name: "creads_crear_imagen", title: "Crear imagen",
    description: "Creates one image with Creads from a detailed description (ads, products, social posts). Spends the account's credits. Returns a link to the image. Describe scene, subject, style and any exact text to show.",
    inputSchema: { type: "object", properties: {
      descripcion: { type: "string", minLength: 10, maxLength: 4000, description: "What the image shows, in detail (any language)." },
      formato: { type: "string", enum: ["9:16", "1:1", "4:5", "16:9"], default: "4:5", description: "Aspect ratio: 4:5 feed, 9:16 stories/reels, 1:1 square, 16:9 wide." },
    }, required: ["descripcion"], additionalProperties: false },
    annotations: { title: "Crear imagen", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (a, call, origin) => {
      const d = await call<{ url: string }>("/api/generate/image", { prompt: str(a.descripcion), aspect: str(a.formato, 5) || "4:5" });
      const url = abs(origin, d.url);
      return { text: `Imagen lista: ${url}`, data: { url } };
    },
  },
  {
    name: "creads_crear_anuncio", title: "Crear anuncio en video",
    description: `Orders a finished vertical video ad from a script: Creads picks the scenes, generates the clips, checks quality, redoes severe errors and assembles it with subtitles. Spends the account's credits. Takes a few minutes: then call creads_estado_anuncio with the returned id every 30–60 seconds until it is «listo». Formats: ${API_FORMATS.join(", ")} (ugc = a person talking to the camera).`,
    inputSchema: { type: "object", properties: {
      guion: { type: "string", minLength: 20, maxLength: 4000, description: "The script the person says, word for word (15–40 seconds of speech works best)." },
      formato: { type: "string", enum: API_FORMATS, default: "ugc" },
      idioma: { type: "string", enum: ["es-CL", "en"], default: "es-CL", description: "Spoken language: Chilean Spanish or English." },
      titulo: { type: "string", maxLength: 80, description: "Short name to find it later." },
    }, required: ["guion"], additionalProperties: false },
    annotations: { title: "Crear anuncio en video", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (a, call) => {
      const d = await call<{ anuncio: Json }>("/api/v1/anuncios", { guion: str(a.guion), formato: str(a.formato, 30) || "ugc", idioma: a.idioma === "en" ? "en" : "es-CL", ...(str(a.titulo, 80) ? { titulo: str(a.titulo, 80) } : {}) });
      return { text: `Anuncio pedido (id ${d.anuncio.id}). Está «${d.anuncio.estado}». Consulta su avance con creads_estado_anuncio cada 30 a 60 segundos.`, data: d.anuncio };
    },
  },
  {
    name: "creads_estado_anuncio", title: "Ver avance de un anuncio",
    description: "Shows the progress of a video ad ordered with creads_crear_anuncio and moves it to its next step. When «listo», returns the video link (it opens in the user's Creads account).",
    inputSchema: { type: "object", properties: { id: { type: "string", pattern: "^ad_[a-z0-9]{6,20}$", description: "The ad id (ad_…)." } }, required: ["id"], additionalProperties: false },
    annotations: { title: "Ver avance de un anuncio", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    run: async (a, call) => {
      const id = str(a.id, 30);
      if (!/^ad_[a-z0-9]{6,20}$/.test(id)) throw new Error("El id debe ser como ad_xxxxxx.");
      const d = await call<{ anuncio: { estado: string; paso?: string | null; video_url?: string | null; error?: string | null } & Json }>(`/api/v1/anuncios/${id}`);
      const x = d.anuncio;
      const text = x.estado === "listo" ? `Listo: ${x.video_url}` : x.estado === "error" ? `No se pudo terminar: ${x.error ?? "error"}` : `En proceso: ${x.paso ?? x.estado}. Vuelve a consultar en 30 a 60 segundos.`;
      return { text, data: x };
    },
  },
  {
    name: "creads_mis_anuncios", title: "Ver mis anuncios",
    description: "Lists the latest video ads of the account made through the API or connectors, with their status and links.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "Ver mis anuncios", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (_a, call) => {
      const d = await call<{ anuncios: { id: string; titulo: string; estado: string; video_url?: string | null }[] }>("/api/v1/anuncios");
      if (!d.anuncios.length) return { text: "Todavía no hay anuncios hechos por API.", data: { anuncios: [] } };
      return { text: d.anuncios.slice(0, 20).map((x) => `• ${x.titulo} (${x.id}): ${x.estado}${x.video_url ? ` · ${x.video_url}` : ""}`).join("\n"), data: { anuncios: d.anuncios } };
    },
  },
];

const ok = (id: unknown, result: Json) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** Errors as plain words for the chat (no prices, no upgrade pitches: buying happens on creadsia.com). */
function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  // the studio's messages are already safe for customers; only a «buy/recharge a plan» pitch is replaced
  if (/crédit|credit/i.test(m) && /recarg|compr|plan|mejora/i.test(m)) return "La cuenta de Creads no tiene créditos suficientes para esto.";
  if (/sesión terminó|401/i.test(m)) return "La conexión con Creads venció. Vuelve a conectar Creads.";
  return m.slice(0, 300);
}

/** One JSON-RPC message → its answer (null for notifications). */
export async function handle(msg: Json, call: Call, origin: string): Promise<Json | null> {
  const id = msg?.id;
  const method = typeof msg?.method === "string" ? msg.method : "";
  if (msg?.jsonrpc !== "2.0" || !method) return id === undefined ? null : fail(id, -32600, "Invalid request");
  if (id === undefined || id === null) return null; // notifications (initialized, cancelled…) need no answer
  const params = (msg.params ?? {}) as Json;
  switch (method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "creads", title: "Creads", version: "1.0.0" },
        instructions: "Creads makes images and finished video ads with AI, in Spanish and English, with quality checks. Images return right away; video ads take minutes: order with creads_crear_anuncio and follow with creads_estado_anuncio. Both spend the user's Creads credits, so confirm what the user wants before ordering.",
      });
    }
    case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(params.name)}`);
      try {
        const r = await tool.run((params.arguments ?? {}) as Json, call, origin);
        return ok(id, { content: [{ type: "text", text: r.text }], ...(r.data ? { structuredContent: r.data } : {}), isError: false });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: friendly(e) }], isError: true });
      }
    }
    case "resources/list": return ok(id, { resources: [] });
    case "prompts/list": return ok(id, { prompts: [] });
    default: return fail(id, -32601, `Method not found: ${method}`);
  }
}
