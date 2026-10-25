import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { TOOLS, type Call, type Ctx } from "@/lib/mcp";
import { studioAs } from "@/lib/api-ads";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { RECETA } from "@/lib/asistente-receta";
import { flatten, repair } from "@/lib/asistente-history";
import { publicError } from "@/lib/public-error";
import { explainFailure, outOfFundsService } from "@/lib/balances";
import { isOwner } from "@/lib/auth";
import { fetchRetry } from "@/lib/providers/retry";
import { SHOWN_PLANS, clpFor } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import { PRUEBA_DIAS, hasPaid, tarjetaObligatoria } from "@/lib/regalo";
import { sbRest } from "@/lib/supabase";

const regaloDado = async (ws: string) => (await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&ref=eq.${encodeURIComponent(`regalo:${ws}`)}&select=id&limit=1`).catch(() => [])).length > 0;

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// «Automático»: the customer talks; Claude (with the Creads tools and the RECETA) asks, writes the script,
// creates the person, orders the ad, reviews it and hands it over. Stateless: the page keeps the conversation
// and sends it back each turn. Pictures reach the model only on the turn they appear (as text afterwards), so
// old signed links never expire inside the history.

const MODEL = process.env.CLAUDE_ASISTENTE_MODEL || "claude-opus-5-5";
const MAX_STEPS = 12; // a demo orders up to 7 ads in one turn
const USE = new Set(["creads_saldo", "creads_crear_imagen", "creads_crear_avatar", "creads_crear_anuncio", "creads_revisar_anuncio", "creads_avatares", "creads_ver_imagen", "creads_voces", "creads_montar_demo", "creads_corregir_subtitulos"]);

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
  const history = repair((Array.isArray(b?.messages) ? b.messages : []).map(clean).filter((m: Msg | null): m is Msg => Boolean(m)).slice(-40));
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
  // pictures go as a link Claude downloads itself (base64 copies made requests too big: Benjamín's story-format batch)
  const look = async (ref: string) => (ownsMedia(ref, ws) && /\.(png|jpe?g|webp)$/i.test(ref) ? { type: "image", source: { type: "url", url: await fetchableUrl(ref, ws, 3600) } } : null);
  const pics = (await Promise.all(shown.map((r) => look(r).catch(() => null)))).filter(Boolean);
  const msgs: { role: string; content: unknown }[] = history.map((m: Msg) => ({ role: m.role, content: m.content }));
  if (pics.length) {
    const base = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
    msgs[msgs.length - 1] = { role: "user", content: [...pics, ...base] };
  }

  const tools = TOOLS.filter((t) => USE.has(t.name)).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  // Prompt caching (owner, 22 Oct 2026): the recipe, the tools and the conversation so far are sent again on
  // every call; marked as cache they cost ~10% the second time. Same answers, same quality, much cheaper.
  const ephemeral = { type: "ephemeral" } as const;
  const cachedTools = tools.map((t, i) => (i === tools.length - 1 ? { ...t, cache_control: ephemeral } : t));
  const system: { type: "text"; text: string; cache_control?: typeof ephemeral }[] = [{ type: "text", text: RECETA, cache_control: ephemeral }];
  // card trial: a new account with no credits gets its gift by adding a card (the card box is above the chat)
  // card trial: the conversation is free (questions, angles, the two scripts); the card is asked for at the
  // moment the customer has seen their scripts and wants the video (owner, 25 Oct 2026)
  const sinTarjeta = tarjetaObligatoria() && ws !== "main" && !(await hasPaid(ws).catch(() => true)) && !(await regaloDado(ws));
  if (sinTarjeta) system.push({ type: "text", text: `PRUEBA CON TARJETA (este cliente aún no la activa, tiene 0 créditos): conversa y trabaja gratis como siempre (preguntas, ángulo, los dos guiones), pero NO llames herramientas que gastan créditos (crear anuncio, imagen, avatar, demo) ni creads_saldo. Cuando ya le mostraste sus guiones (o pide el video), dile en una o dos frases que para hacer su video con sus 200 créditos de regalo active su prueba gratis de ${PRUEBA_DIAS} días: agrega su tarjeta en Mercado Pago, hoy no se cobra nada, y si no cancela antes, al terminar se cobra el plan Básico cada mes. Termina ESE mensaje con la marca exacta [[TARJETA]] (abre la ventana para agregarla). Nunca pidas datos de tarjeta en el chat. Cuando vuelva con la prueba activa, sigue donde quedaron con el guion que eligió.` });
  // prices in the customer's money (owner, 24 Oct 2026): pesos in Chile, US$ elsewhere
  if (await inChile(req)) {
    const rate = await usdClpRate().catch(() => 950);
    const list = SHOWN_PLANS.map((p) => `${p.name} $${clpFor(p.monthly, rate).toLocaleString("es-CL")}`).join(", ");
    system.push({ type: "text", text: `PRECIOS: este cliente está en Chile. Cuando hables de precios dilos en pesos chilenos, nunca en dólares: ${list} al mes («planes desde $${clpFor(Math.min(...SHOWN_PLANS.map((p) => p.monthly)), rate).toLocaleString("es-CL")} al mes»).` });
  }
  /** The conversation with a cache mark on its last block (only the newest message carries one). */
  const withCache = (list: { role: string; content: unknown }[]) => list.map((m, i) => {
    if (i !== list.length - 1) return m;
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : [...(m.content as Block[])];
    if (!blocks.length) return m;
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: ephemeral };
    return { role: m.role, content: blocks };
  });
  const added: Msg[] = []; // what the page appends to its history (pictures as notes)
  const ui = { images: [] as string[], ads: [] as string[], tarjeta: false };
  let pendingNote = false;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const ask = () => fetchRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, tools: cachedTools, messages: withCache(msgs) }),
        signal: AbortSignal.timeout(120_000),
      });
      let res = await ask();
      let data = await res.json().catch(() => null);
      // a conversation Claude refuses because of an unpaired tool call (Gastón, 22 Oct 2026): rebuilt as plain
      // notes and asked again, instead of the customer getting stuck
      if (res.status === 400 && /tool_use|tool_result/.test(String(data?.error?.message ?? ""))) {
        console.error("asistente: conversación reparada", String(data?.error?.message ?? "").slice(0, 200));
        const fixed = flatten(msgs as Msg[]);
        msgs.splice(0, msgs.length, ...fixed);
        res = await ask();
        data = await res.json().catch(() => null);
      }
      if (!res.ok) throw new Error(`asistente ${res.status}: ${data?.error?.message ?? ""}`);
      const raw = (data?.content ?? []) as Block[];
      const finished = data?.stop_reason === "tool_use";
      // tool calls only count when the reply finished asking for them (a reply cut at the token limit is dropped)
      const content = raw.filter((x) => x.type === "text" ? String(x.text ?? "").trim() : x.type !== "tool_use" || finished);
      if (!content.length) { added.push({ role: "assistant", content: [{ type: "text", text: "Se me cortó la respuesta. Escribe «continúa» y sigo donde quedé." }] }); break; }
      // «[[TARJETA]]»: the moment to ask for the card; the page opens the trial window and never shows the mark
      for (const x of content) if (x.type === "text" && String(x.text).includes("[[TARJETA]]")) { ui.tarjeta = true; x.text = String(x.text).replace(/\s*\[\[TARJETA\]\]\s*/g, " ").trim(); }
      msgs.push({ role: "assistant", content });
      added.push({ role: "assistant", content: content.filter((x) => x.type === "text" || x.type === "tool_use") });
      const uses = content.filter((x) => x.type === "tool_use");
      if (!finished || !uses.length) {
        if (data?.stop_reason === "max_tokens") added.push({ role: "assistant", content: [{ type: "text", text: "Se me cortó la respuesta. Escribe «continúa» y sigo donde quedé." }] });
        break;
      }
      if (step === MAX_STEPS - 1) pendingNote = true;

      const results: Block[] = [];
      const notes: Block[] = [];
      for (const u of uses) {
        const tool = TOOLS.find((t) => t.name === u.name && USE.has(t.name));
        try {
          if (!tool) throw new Error("Herramienta no disponible.");
          const r = await tool.run((u.input ?? {}) as Record<string, unknown>, call, origin, ctx);
          const imgs = (r.images ?? []).slice(0, 3);
          ui.images.push(...imgs);
          if ((u.name === "creads_crear_anuncio" || u.name === "creads_montar_demo" || u.name === "creads_corregir_subtitulos") && typeof r.data?.id === "string") ui.ads.push(r.data.id);
          const seen = (await Promise.all(imgs.map((i) => look(i).catch(() => null)))).filter(Boolean);
          const text = `${r.text}${imgs.length ? `\n(Imagen: ${imgs.join(", ")})` : ""}`;
          results.push({ type: "tool_result", tool_use_id: u.id, content: [{ type: "text", text }, ...seen] as Block[] });
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
    if (pendingNote) added.push({ role: "assistant", content: [{ type: "text", text: "Voy avanzando, pero es harto trabajo de una vez. Escribe «continúa» y sigo." }] });
    return NextResponse.json({ messages: added, ui });
  } catch (err) {
    console.error("asistente-anuncios", err instanceof Error ? err.message : err);
    // Claude without balance: the owner is told exactly that (and it shows in Saldos); a customer sees a calm message
    const svc = outOfFundsService(err, "claude");
    const error = svc ? (isOwner(s.user) ? await explainFailure(err, true, "claude") : "El asistente no está disponible en este momento. Vuelve a intentar en unos minutos.") : (isOwner(s.user) ? `El asistente falló: ${(err instanceof Error ? err.message : String(err)).slice(0, 300)}` : publicError(err, "El asistente no pudo responder. Intenta de nuevo."));
    return NextResponse.json({ error, messages: added, ui }, { status: 502 });
  }
}

/** Is the customer in Chile? Vercel's geo header, or the country the site already chose for them. */
async function inChile(req: Request) {
  const geo = req.headers.get("x-vercel-ip-country");
  const cookie = /(?:^|;\s*)creads_pais=([A-Z]{2})/.exec(req.headers.get("cookie") ?? "")?.[1];
  return (cookie ?? geo ?? "").toUpperCase() === "CL";
}
