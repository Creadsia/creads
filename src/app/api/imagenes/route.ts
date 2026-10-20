import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { needsCredits } from "@/lib/credits";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { FEATURE_UNAVAILABLE, publicError } from "@/lib/public-error";
import { IMAGE_STYLES, ideasPrompt, reviewPrompt, type ImageStyle } from "@/lib/image-batch";

export const maxDuration = 60;

// «Varias imágenes a la vez» (back from the prototype, 20 Oct 2026). Two steps, both free for the customer
// (the images themselves are charged one by one by /api/generate/image):
//   {accion:"ideas", idea, estilo, n, aspect} → n different image prompts, one angle each
//   {accion:"revisar", url, prompt}           → a quick look at a finished image: text spelled right, no glitches
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  if (!textAI.configured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });
  const b = await req.json().catch(() => null);

  try {
    if (b?.accion === "ideas") {
      const broke = await needsCredits(s.user);
      if (broke) return NextResponse.json({ error: broke }, { status: 402 });
      const idea = typeof b.idea === "string" ? b.idea.trim().slice(0, 2000) : "";
      if (idea.length < 10) return NextResponse.json({ error: "Cuenta un poco más qué quieres mostrar." }, { status: 400 });
      const n = Math.min(12, Math.max(1, Math.round(Number(b.n) || 4)));
      const estilo = (IMAGE_STYLES.some((x) => x.id === b.estilo) ? b.estilo : "libre") as ImageStyle;
      const aspect = ["9:16", "1:1", "4:5", "16:9"].includes(b.aspect) ? b.aspect : "4:5";
      const raw = await textAI.complete({ prompt: ideasPrompt(idea, estilo, n, aspect), json: true, maxTokens: 3000 });
      const out = parseJSON<{ prompts?: unknown }>(raw);
      const prompts = (Array.isArray(out?.prompts) ? out.prompts : []).filter((p): p is string => typeof p === "string" && p.trim().length > 10).map((p) => p.trim().slice(0, 1500)).slice(0, n);
      if (!prompts.length) throw new Error("No salieron ideas.");
      return NextResponse.json({ prompts });
    }

    if (b?.accion === "revisar") {
      if (!ownsMedia(b.url, s.user.workspace)) return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });
      const url = await fetchableUrl(b.url, s.user.workspace, 600);
      const prompt = typeof b.prompt === "string" ? b.prompt.slice(0, 1500) : "";
      const raw = await textAI.complete({ prompt: reviewPrompt(prompt), images: [url], json: true, maxTokens: 300, fast: true });
      const r = parseJSON<{ ok?: unknown; nota?: unknown }>(raw);
      return NextResponse.json({ ok: r?.ok !== false, nota: typeof r?.nota === "string" ? r.nota.slice(0, 200) : "" });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (err) {
    console.error("imagenes", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudieron preparar las imágenes. Vuelve a intentarlo.") }, { status: 500 });
  }
}
