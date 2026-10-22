import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { TOOLS, type Call, type Ctx } from "@/lib/mcp";
import { studioAs } from "@/lib/api-ads";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { RECETA } from "@/lib/asistente-receta";
import { publicError } from "@/lib/public-error";
import { explainFailure, outOfFundsService } from "@/lib/balances";
import { isOwner } from "@/lib/auth";
import { fetchRetry } from "@/lib/providers/retry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// «Automático»: the customer talks; Claude (with the Creads tools and the RECETA) asks, writes the script,
// creates the person, orders the ad, reviews it and hands it over. Stateless: the page keeps the conversation
// and sends it back each turn. Pictures reach the model only on the turn they appear (as text afterwards), so
// old signed links never expire inside the history.

const MODEL = process.env.CLAUDE_ASISTENTE_MODEL || "claude-opus-5-5";
const MAX_STEPS = 12; // a demo orders up to 7 ads in one turn
const USE = new Set(["creads_saldo", "creads_crear_imagen", "creads_crear_avatar", "creads_crear_anuncio", "creads_revisar_anuncio", "creads_avatares", "creads_ver_imagen", "creads_voces", "creads_montar_demo"]);

type Block = Record<string, unknown> & { type: string };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
const REF = /\/api\/media\/ws\/[\w-]+\/[\w./-]+\.(?:png|jpe?g|webp)/gi;

/** Only text, tool calls and tool results travel in the history (pictures become a short note). */
function clean(m: unknown): Msg | null {
  const x = m as { role?: unknown; content?: unknown };
  if (x?.role !== "user" && x?.role !== "assistant") return null;
  if (typeof x.content === "string") return { role: x.role, content: x.content.slice(0, 6000) };
  if (!Array.isArray(x.content)) return null;
  const blocks: Block[] = [];
  for (const b of x.content as Block[]) {
    if (b?.type === "text" && typeof b.text === "string") blocks.push({ type: "text", text: b.text.slice(0, 6000) });
    else if (b?.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string") blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.input ?? {} });
    else if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
      const inner = Array.isArray(b.content) ? (b.content as Block[]).filter((c) => c?.type === "text").map((c) => String(c.text ?? "")).join("\n") : String(b.content ?? "");
      blocks.push({ type: "tool_result", tool_use_id: b.tool_use_id, content: inner.slice(0, 4000), ...(b.is_error ? { is_error: true } : {}) });
    }
  }
  return blocks.length ? { role: x.role, content: blocks } : null;
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "El asistente no está disponible en este momento." }, { status: 503 });
  const b = await req.json().catch(() => null);
  const history = (Array.isArray(b?.messages) ? b.messages : []).map(clean).filter((m: Msg | null): m is Msg => Boolean(m)).slice(-40);
  if (!history.length || history[history.length - 1].role !== "user") return NextResponse.json({ error: "Escribe tu mensaje." }, { status: 400 });

  const ws = s.user.workspace;
  const studio = studioAs(req);
  const call: Call = <T,>(path: string, body?: unknown) => studio<T>(path, body);
  const ctx: Ctx = {
    link: async (ref) => (ownsMedia(ref, ws) ? fetchableUrl(ref, ws, 3600) : null),
    picture: async (ref) => {
      if (!ownsMedia(ref, ws) || !/\.(png|jpe?g|webp)$/i.test(ref)) return null;
      const res = await fetch(await fetchableUrl(ref, ws, 300), { signal: AbortSignal.timeout(20_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(png|jpeg|webp)/.test(type)) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.byteLength > 3_500_000 ? null : { data: buf.toString("base64"), mimeType: type.split(";")[0] };
    },
  };
  const origin = new URL(req.url).origin;

  // the photos the customer just uploaded are shown to the model with their message
  const last = history[history.length - 1];
  const lastText = typeof last.content === "string" ? last.content : last.content.filter((x: Block) => x.type === "text").map((x: Block) => String(x.text)).join("\n");
  const shown = [...new Set<string>(lastText.match(REF) ?? [])].slice(0, 3);
  const pics = (await Promise.all(shown.map((r) => ctx.picture(r).catch(() => null)))).filter((p): p is { data: string; mimeType: string } => Boolean(p));
  const msgs: { role: string; content: unknown }[] = history.map((m: Msg) => ({ role: m.role, content: m.content }));
  if (pics.length) {
    const base = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
    msgs[msgs.length - 1] = { role: "user", content: [...pics.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mimeType, data: p.data } })), ...base] };
  }

  const tools = TOOLS.filter((t) => USE.has(t.name)).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const added: Msg[] = []; // what the page appends to its history (pictures as notes)
  const ui = { images: [] as string[], ads: [] as string[] };

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetchRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: RECETA, tools, messages: msgs }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`asistente ${res.status}: ${data?.error?.message ?? ""}`);
      const content = (data?.content ?? []) as Block[];
      msgs.push({ role: "assistant", content });
      added.push({ role: "assistant", content: content.filter((x) => x.type === "text" || x.type === "tool_use") });
      const uses = content.filter((x) => x.type === "tool_use");
      if (data?.stop_reason !== "tool_use" || !uses.length) break;

      const results: Block[] = [];
      const notes: Block[] = [];
      for (const u of uses) {
        const tool = TOOLS.find((t) => t.name === u.name && USE.has(t.name));
        try {
          if (!tool) throw new Error("Herramienta no disponible.");
          const r = await tool.run((u.input ?? {}) as Record<string, unknown>, call, origin, ctx);
          const imgs = (r.images ?? []).slice(0, 3);
          ui.images.push(...imgs);
          if ((u.name === "creads_crear_anuncio" || u.name === "creads_montar_demo") && typeof r.data?.id === "string") ui.ads.push(r.data.id);
          const seen = (await Promise.all(imgs.map((i) => ctx.picture(i).catch(() => null)))).filter((p): p is { data: string; mimeType: string } => Boolean(p));
          const text = `${r.text}${imgs.length ? `\n(Imagen: ${imgs.join(", ")})` : ""}`;
          results.push({ type: "tool_result", tool_use_id: u.id, content: [{ type: "text", text }, ...seen.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mimeType, data: p.data } }))] });
          notes.push({ type: "tool_result", tool_use_id: u.id, content: text });
        } catch (e) {
          const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
          results.push({ type: "tool_result", tool_use_id: u.id, content: msg, is_error: true });
          notes.push({ type: "tool_result", tool_use_id: u.id, content: msg, is_error: true });
        }
      }
      msgs.push({ role: "user", content: results });
      added.push({ role: "user", content: notes });
    }
    return NextResponse.json({ messages: added, ui });
  } catch (err) {
    console.error("asistente-anuncios", err instanceof Error ? err.message : err);
    // Claude without balance: the owner is told exactly that (and it shows in Saldos); a customer sees a calm message
    const svc = outOfFundsService(err, "claude");
    const error = svc ? (isOwner(s.user) ? await explainFailure(err, true, "claude") : "El asistente no está disponible en este momento. Vuelve a intentar en unos minutos.") : publicError(err, "El asistente no pudo responder. Intenta de nuevo.");
    return NextResponse.json({ error, messages: added, ui }, { status: 502 });
  }
}
