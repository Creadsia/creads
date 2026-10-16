import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db, DbError } from "@/lib/db";
import { findVideo } from "@/lib/providers";

// Creates an ad and one clip per cut, ready to be generated (step 4 of "Crear anuncio").
export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => null);
  const clips: { tipo: string; texto: string; prompt: string; framePrompt?: string }[] = Array.isArray(b?.clips) ? b.clips.slice(0, 8) : [];
  const model = findVideo(String(b?.model ?? ""));
  if (!clips.length || clips.some((c) => !c?.prompt || !c?.texto)) return NextResponse.json({ error: "Faltan las escenas." }, { status: 400 });
  if (!model) return NextResponse.json({ error: "Elige un modelo de video." }, { status: 400 });
  if (!model.configured()) return NextResponse.json({ error: `${model.label}: falta la clave en Vercel.` }, { status: 503 });

  try {
    const [avatar, product] = await Promise.all([
      b?.avatarId ? db.get("avatars", String(b.avatarId)) : null,
      b?.productId ? db.get("products", String(b.productId)) : null,
    ]);
    const ad = await db.insert("ads", {
      title: String(b?.title ?? "Anuncio").slice(0, 120),
      script_id: b?.scriptId || null,
      format: String(b?.format ?? "ugc"),
      aspect: String(b?.aspect ?? "9:16"),
      model: model.id,
      status: "generating",
      settings: {
        lang: b?.lang === "es-CL" ? "es-CL" : "en",
        avatar: avatar ? { id: avatar.id, name: avatar.name, image_url: avatar.image_url, voice_id: avatar.voice_id } : null,
        product: product ? { id: product.id, name: product.name, image_url: product.image_url } : null,
      },
    });
    const rows = [];
    for (let i = 0; i < clips.length; i++) {
      rows.push(await db.insert("clips", {
        ad_id: ad.id, idx: i, kind: clips[i].tipo, text: clips[i].texto, prompt: clips[i].prompt,
        model: model.id, status: "pending",
      }));
    }
    // Keep the first-frame prompt per clip in the ad settings (used by /api/clips/run).
    await db.update("ads", String(ad.id), { settings: { ...(ad.settings as object), frames: clips.map((c) => c.framePrompt ?? "") } });
    return NextResponse.json({ ad, clips: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo crear el anuncio.";
    return NextResponse.json({ error: msg, missingTable: err instanceof DbError && err.missingTable }, { status: 502 });
  }
}
