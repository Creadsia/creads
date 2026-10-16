import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { findImage } from "@/lib/providers";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { uploadMedia } from "@/lib/supabase";

export const maxDuration = 120;

const ASPECTS: AspectRatio[] = ["9:16", "1:1", "4:5", "16:9"];

// Generates one image and stores it in our own storage. Costs real money: the studio shows the price first.
export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  const aspect: AspectRatio = ASPECTS.includes(body?.aspect) ? body.aspect : "9:16";
  const refs: MediaRef[] = Array.isArray(body?.refs)
    ? body.refs
        .filter((r: MediaRef) => typeof r?.url === "string" && (r.role === "face" || r.role === "product"))
        .slice(0, 3)
    : [];
  if (prompt.length < 10) return NextResponse.json({ error: "Describe la imagen con un poco más de detalle." }, { status: 400 });

  const provider = findImage(body?.model || "nano-banana-pro");
  if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });
  if (!provider.configured()) return NextResponse.json({ error: `${provider.label}: falta la clave en Vercel.` }, { status: 503 });

  try {
    const { bytes, mime } = await provider.generate({ prompt, aspect, refs });
    const ext = mime.includes("jpeg") ? "jpg" : mime.split("/")[1] || "png";
    const url = await uploadMedia(`images/${randomUUID()}.${ext}`, bytes, mime);
    return NextResponse.json({ url, model: provider.id, usd: provider.usdPerImage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo generar la imagen.";
    console.error("generate/image", provider.id, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
