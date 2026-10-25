import { NextResponse } from "next/server";
import { allow, clientIp, limitMessage, tooMany } from "@/lib/rate";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { FEATURE_UNAVAILABLE } from "@/lib/public-error";
import { leerPagina } from "@/lib/tanda";
import { entradaHooks, hooksPrompt, leerHooks } from "@/lib/generador-hooks";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Public «Generador de hooks» (/generador-de-hooks, no account): POST {url | descripcion, idioma}
//   → {producto, angulos: [{tipo, titulo, por_que, hooks[]}], leido}. 3 uses per connection per day and a
// daily ceiling for everyone together (src/lib/rate.ts), checked before the page is read or the AI is called.
export async function POST(req: Request) {
  const input = entradaHooks(await req.json().catch(() => null));
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!textAI.configured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });
  const limited = await tooMany("hooksIp", clientIp(req));
  if (limited) return limited;
  if (!(await allow("hooksAll", "all"))) return NextResponse.json({ error: limitMessage("hooksAll") }, { status: 429 });

  try {
    const pagina = input.url ? await leerPagina(input.url) : undefined;
    if (pagina && pagina.texto.length < 80 && !pagina.descripcion) {
      return NextResponse.json({ error: "No pudimos leer el contenido de esa página (puede que se arme con JavaScript). Describe tu producto en dos frases y seguimos." }, { status: 422 });
    }
    // one call to the main text model; short answer (about US$0.02–0.04 per use)
    const raw = await textAI.complete({ prompt: hooksPrompt({ pagina, descripcion: input.descripcion, idioma: input.idioma }), json: true, maxTokens: 1500 });
    const out = leerHooks(parseJSON(raw), input.idioma);
    if (!out) throw new Error("No salieron hooks.");
    return NextResponse.json({ ...out, idioma: input.idioma, leido: pagina ? { titulo: pagina.titulo, url: pagina.url } : null });
  } catch (e) {
    const msg = e instanceof Error && /link|página|dirección|archivo|redirige/.test(e.message) ? e.message : "No pudimos crear tus hooks. Intenta de nuevo en un momento.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
