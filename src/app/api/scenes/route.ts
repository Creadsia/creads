import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { type CutIn, type Direction, type SceneContext, directorPrompt, scenePrompt } from "@/lib/director";
import { FORMATS, type FormatId } from "@/lib/formats";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 120;

// Step 3 of "Crear anuncio": Claude directs every cut, then each cut gets its video prompt.
export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  if (!textAI.configured()) return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en Vercel." }, { status: 503 });

  const b = await req.json().catch(() => null);
  const cuts: CutIn[] = Array.isArray(b?.cuts) ? b.cuts.filter((c: CutIn) => typeof c?.texto === "string" && c.texto.trim()).slice(0, 8) : [];
  if (!cuts.length) return NextResponse.json({ error: "Faltan los cortes." }, { status: 400 });
  const format = (FORMATS.some((f) => f.id === b?.format) ? b.format : "ugc") as FormatId;

  try {
    const [avatar, product, rules] = await Promise.all([
      b?.avatarId ? db.get("avatars", String(b.avatarId)).catch(() => null) : null,
      b?.productId ? db.get("products", String(b.productId)).catch(() => null) : null,
      db.list("rules", "active=eq.true&order=hits.desc&limit=40").catch(() => []),
    ]);
    const ctx: SceneContext = {
      format,
      lang: b?.lang === "es-CL" ? "es-CL" : "en",
      aspect: (["9:16", "16:9", "1:1", "4:5"].includes(b?.aspect) ? b.aspect : "9:16") as SceneContext["aspect"],
      avatar: avatar
        ? { description: String(avatar.description || avatar.name || ""), hasPhoto: Boolean(avatar.image_url) }
        : typeof b?.avatarText === "string" && b.avatarText.trim()
          ? { description: b.avatarText.trim().slice(0, 400), hasPhoto: false }
          : null,
      product: product ? { name: String(product.name), description: String(product.description || ""), hasPhoto: Boolean(product.image_url) } : null,
      place: typeof b?.place === "string" ? b.place.slice(0, 300) : "",
      direction: typeof b?.direction === "string" ? b.direction.slice(0, 1200) : "",
      rules: (rules as Record<string, unknown>[])
        .filter((r) => { const f = (r.formats as string[] | null) ?? ["all"]; return !f.length || f.includes("all") || f.includes(format); })
        .map((r) => String(r.rule_en)),
      script: typeof b?.script === "string" ? b.script : cuts.map((c) => c.texto).join(" "),
    };

    const out = parseJSON<Direction[] | { cuts: Direction[] }>(
      await textAI.complete({ prompt: directorPrompt(ctx, cuts), json: true }),
    );
    const dirs = Array.isArray(out) ? out : out?.cuts ?? [];
    const by: Record<string, Direction> = {};
    dirs.forEach((d) => { if (d?.label != null) by[String(d.label)] = d; });
    const scenes = cuts.map((c, i) => {
      const d = by[String(i + 1)] ?? dirs[i] ?? {};
      return { dir: d, prompt: scenePrompt(ctx, c, d, i) };
    });
    return NextResponse.json({ scenes, rulesUsed: ctx.rules?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudieron dirigir las escenas.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
