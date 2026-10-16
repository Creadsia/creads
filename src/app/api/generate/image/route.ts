import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { findImage } from "@/lib/providers";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";

export const maxDuration = 120;

const ASPECTS: AspectRatio[] = ["9:16", "1:1", "4:5", "16:9"];

// Generates one image and stores it in our own storage. Costs real money: the studio shows the price first.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const { db } = s;

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  const aspect: AspectRatio = ASPECTS.includes(body?.aspect) ? body.aspect : "9:16";
  // references must be this customer's own files
  const refs: MediaRef[] = Array.isArray(body?.refs)
    ? body.refs
        .filter((r: MediaRef) => ownsMedia(r?.url, s.user.workspace) && (r.role === "face" || r.role === "product"))
        .slice(0, 3)
    : [];
  if (prompt.length < 10) return NextResponse.json({ error: "Describe la imagen con un poco más de detalle." }, { status: 400 });

  const provider = findImage(body?.model || "nano-banana-pro");
  if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });
  if (!provider.configured()) return NextResponse.json({ error: `${provider.label}: falta la clave en Vercel.` }, { status: 503 });

  const svc = serviceOfModel(provider.id);
  let ref = "";
  try {
    ref = (await payFor(s.user, provider.usdPerImage, `Imagen · ${provider.label}`, svc)).ref;
    const open = await Promise.all(refs.map(async (r) => ({ ...r, url: await fetchableUrl(r.url, s.user.workspace) })));
    const { bytes, mime } = await provider.generate({ prompt, aspect, refs: open });
    const url = await saveMedia(s.user.workspace, "images", bytes, mime);
    // keep it in the library and in "Tus creaciones" (a missing table never blocks the result)
    await Promise.all([
      db.insert("images", { prompt, url, model: provider.id, aspect }),
      db.insert("clips", { kind: "gen:image", prompt, model: provider.label, status: "done", url, usd: provider.usdPerImage }),
    ]).catch(() => null);
    return NextResponse.json({ url, model: provider.id, usd: provider.usdPerImage });
  } catch (err) {
    console.error("generate/image", provider.id, err instanceof Error ? err.message : err);
    if (ref) await refundJob(s.user.workspace, ref);
    return NextResponse.json({ error: await failMessage(err, s.user, svc) }, { status: failStatus(err) });
  }
}
