import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { textAI } from "@/lib/providers";
import { RECETA } from "@/lib/asistente-receta";
import { publicError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// «Generador de prompts» (owner, 22 Oct 2026): the customer fills a short form and Creads writes the request
// the way our best ads were asked for — for Automático (one text to paste) or for Manual (script, person,
// photo and scenes). The know-how is the same recipe Automático follows. Free: it only writes text.

type Tipo = "ugc" | "demo" | "imagenes";
const clean = (v: unknown, max = 400) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  if (!textAI.configured()) return NextResponse.json({ error: "El generador no está disponible en este momento." }, { status: 503 });
  const b = (await req.json().catch(() => null)) ?? {};
  const tipo: Tipo = ["ugc", "demo", "imagenes"].includes(b.tipo) ? b.tipo : "ugc";
  const destino = tipo === "demo" ? "automatico" : b.destino === "manual" ? "manual" : "automatico";
  const f = (b.campos ?? {}) as Record<string, unknown>;
  const campos = Object.entries(f).map(([k, v]) => [clean(k, 40), clean(v)]).filter(([k, v]) => k && v).slice(0, 30);
  if (!campos.some(([k]) => k === "negocio")) return NextResponse.json({ error: "Cuéntanos qué vendes (el primer campo)." }, { status: 400 });

  const shape = destino === "automatico"
    ? `{"prompt": "the full request to paste in Automático, in Spanish, written as the customer talking (\\"Quiero un anuncio…\\"), with clear sections in capitals (QUÉ VENDO, A QUIÉN, LA PERSONA, GUION, EDICIÓN…)"}`
    : tipo === "imagenes"
      ? `{"imagenes": [{"titulo": "short name in Spanish", "prompt": "the image description in English, ready for the image generator"}]}`
      : `{"guion": "the script, word for word, in Spanish", "persona": "the avatar description in English (age, looks, exact clothes, place)", "foto": "the prompt for the avatar photo in English, following the photo template of the recipe", "escenas": ["one line per cut in Spanish: what is seen in that cut (same place and clothes)"], "indicaciones": "notes for the Pro editor in Spanish: exact brand, what to highlight, what to avoid, closing"}`;

  // the fixed part (instructions + the recipe) goes as a cached system prompt; the form is the only new text
  const system = `You are Creads' prompt writer. A business owner filled a form; write the request that will make their ad come out right the first time, using ALL the know-how of the recipe below (it is what Creads' assistant follows). Complete what is missing with the best choice for their business, but never invent prices, offers, results, testimonials or health promises they didn't give.

Rules of the script: 18–25 s spoken (45–65 words) for a UGC ad, 85–120 words for a demo presenter, one sentence of 8–14 words per demo clip; first sentence = a hook that names the customer or their problem (never "Hola" or the brand first); then pain → solution with the real offer → remove the risk → ONE clear action. Natural spoken Chilean Spanish unless the form says another accent or English.

THE RECIPE:
"""${RECETA}"""`;
  const prompt = `Type: ${tipo === "ugc" ? "UGC video ad (one person talking to the camera, one place, one outfit)" : tipo === "demo" ? "«Demo con presentador» (a presenter + 3 to 5 short UGC clips of different people showing the product, as in the recipe)" : "images for ads (4:5 feed images; 3 to 6 different ones)"}.
For: ${destino === "automatico" ? "Automático (the chat assistant). One complete request it can follow without asking much: business, audience, offer, the person (age, looks, exact clothes, place), voice and accent, 2 hook options, the script (or what it must say), edit (premium elegant by default, neutral colours: white and black, never purple or Creads colours unless they gave a brand colour), subtitles, closing (brand, web or WhatsApp)." : "Manual (the customer does each step): give each piece ready to paste."}

Form (field: value):
${campos.map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Return only JSON: ${shape}`;

  try {
    const raw = await textAI.complete({ system, prompt, json: true, maxTokens: 2500 });
    const m = raw.match(/\{[\s\S]*\}/);
    const d = m ? JSON.parse(m[0]) : null;
    if (!d) throw new Error("El generador no devolvió un resultado.");
    return NextResponse.json({ destino, tipo, resultado: d });
  } catch (err) {
    console.error("prompts", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo generar. Intenta de nuevo.") }, { status: 502 });
  }
}
